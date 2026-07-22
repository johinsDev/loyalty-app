import type { db as Db } from "@loyalty/db";
import {
  loyaltyCard,
  organizationSettings,
  pointsTransaction,
  redemption,
  reward,
  type RewardInsert,
  type RewardRow,
  rewardAvailability,
} from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, getTableColumns, gte, inArray, like, lt, lte, sql, type SQL } from "drizzle-orm";

import {
  buildOrderBy,
  pageCountOf,
  pageOffset,
  type ListResult,
} from "../_shared/list";
import { availableAtStore } from "../_shared/store-availability";
import { WINDOW_DAYS } from "../points/config";
import { currentTierKey } from "../points/tier-calc";
import { DRAFT_NAME } from "./steps";
import type { RedemptionHistoryItem, RewardAdminListInput } from "./schemas";

/** Columns a wizard step / content patch may write. */
export type RewardPatch = Partial<
  Pick<
    RewardInsert,
    | "name" | "type" | "benefit" | "description" | "imageUrl" | "backgroundCss"
    | "icon" | "fulfillmentNote" | "stampsRequired" | "pointsCost" | "costMode"
    | "allowedTiers" | "limitPerCustomer" | "sections" | "sortOrder" | "storeIds"
  >
>;

export type AdminRewardRow = RewardRow & { redemptions: number };

const DAY_MS = 86_400_000;

export interface Balances {
  stamps: number;
  points: number;
}

export type ClaimTxResult =
  | {
      kind: "claimed";
      redemptionId: string;
      currency: "stamps" | "points";
      stampsSpent: number;
      pointsSpent: number;
      stampsBalance: number;
      pointsBalance: number;
    }
  | { kind: "insufficient" }
  | { kind: "already_claimed" };

/**
 * Drizzle access for rewards: the catalog, the spendable balances (points ledger
 * sum + the active stamp card's `currentStamps`), claim history, and the
 * per-(customer,reward) availability cycle that drives the reminder cron. Only
 * layer that touches the db; the claim runs in a transaction so the balance
 * deduction + redemption row + availability cleanup are atomic.
 */
export class RewardsRepository {
  constructor(readonly db: typeof Db) {}

  // ── Admin CRUD (wizard) ─────────────────────────────────────────────────────
  async createDraft(orgId: string, userId: string, preseed: RewardPatch = {}): Promise<RewardRow> {
    const rows = await this.db
      .insert(reward)
      .values({
        organizationId: orgId,
        createdByUserId: userId,
        status: "draft",
        name: DRAFT_NAME,
        ...preseed,
      })
      .returning();
    return this.#firstOr(rows, "insert");
  }

  async patch(orgId: string, id: string, patch: RewardPatch): Promise<RewardRow> {
    const rows = await this.db
      .update(reward)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(reward.id, id), eq(reward.organizationId, orgId)))
      .returning();
    return this.#firstOr(rows, "patch");
  }

  async markPublished(orgId: string, id: string): Promise<RewardRow> {
    const now = new Date();
    const rows = await this.db
      .update(reward)
      .set({ status: "published", publishedAt: now, updatedAt: now })
      .where(and(eq(reward.id, id), eq(reward.organizationId, orgId)))
      .returning();
    return this.#firstOr(rows, "publish");
  }

  /** Whether this reward is the org's stamps-card prize (its `stampsRequired`
   *  IS the cached stamps goal — mutations must invalidate the config). */
  async isCardReward(orgId: string, id: string): Promise<boolean> {
    const rows = await this.db
      .select({ linked: organizationSettings.stampsCardRewardId })
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, orgId))
      .limit(1);
    return rows[0]?.linked === id;
  }

  async markArchived(orgId: string, id: string): Promise<RewardRow> {
    const rows = await this.db
      .update(reward)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(reward.id, id), eq(reward.organizationId, orgId)))
      .returning();
    return this.#firstOr(rows, "archive");
  }

  async remove(orgId: string, id: string): Promise<void> {
    await this.db.delete(reward).where(and(eq(reward.id, id), eq(reward.organizationId, orgId)));
  }

  async redemptionCount(rewardId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(redemption)
      .where(eq(redemption.rewardId, rewardId));
    return Number(row?.value ?? 0);
  }

  /** Data-table admin list with a `redemptions` count subquery (sortable). */
  async adminList(orgId: string, input: RewardAdminListInput): Promise<ListResult<AdminRewardRow>> {
    const usesExpr = sql<number>`(select count(*) from ${redemption} where ${redemption.rewardId} = ${reward.id})`;
    const conds: (SQL | undefined)[] = [eq(reward.organizationId, orgId)];
    if (input.q) conds.push(like(reward.name, `%${input.q}%`));
    if (input.status?.length) conds.push(inArray(reward.status, input.status));
    if (input.type?.length) conds.push(inArray(reward.type, input.type));
    if (input.storeId) conds.push(availableAtStore(reward.storeIds, input.storeId));
    const where = and(...conds.filter((c): c is SQL => Boolean(c)));

    const orderBy = buildOrderBy(
      input.sort,
      { name: reward.name, createdAt: reward.createdAt, redemptions: usesExpr },
      [asc(reward.sortOrder), desc(reward.updatedAt)],
    );

    const rows = await this.db
      .select({ ...getTableColumns(reward), redemptions: usesExpr })
      .from(reward)
      .where(where)
      .orderBy(...orderBy)
      .limit(input.perPage)
      .offset(pageOffset(input.page, input.perPage));
    const totalRows = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(reward)
      .where(where);
    const total = Number(totalRows[0]?.value ?? 0);
    return {
      rows: rows.map((r) => ({ ...r, redemptions: Number(r.redemptions) })),
      total,
      pageCount: pageCountOf(total, input.perPage),
    };
  }

  #firstOr(rows: RewardRow[], op: string): RewardRow {
    const row = rows[0];
    if (!row)
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `reward ${op} returned no row` });
    return row;
  }

  /** Active rewards, ordered by sortOrder then createdAt, cursor-paginated. The
   *  cursor is the last item's `id` (stable within the deterministic order). */
  async listCatalog(
    orgId: string,
    opts: { search?: string; cursor?: string; storeId?: string; limit: number },
  ): Promise<{ rows: RewardRow[]; nextCursor: string | null }> {
    const all = await this.db
      .select()
      .from(reward)
      .where(
        and(
          eq(reward.organizationId, orgId),
          eq(reward.status, "published"),
          opts.storeId ? availableAtStore(reward.storeIds, opts.storeId) : undefined,
        ),
      )
      .orderBy(asc(reward.sortOrder), asc(reward.createdAt), asc(reward.id));

    const search = opts.search?.toLowerCase();
    const filtered = search
      ? all.filter(
          (r) =>
            r.name.toLowerCase().includes(search) ||
            (r.description?.toLowerCase().includes(search) ?? false),
        )
      : all;

    const startIdx = opts.cursor
      ? filtered.findIndex((r) => r.id === opts.cursor) + 1
      : 0;
    const page = filtered.slice(startIdx, startIdx + opts.limit);
    const nextCursor =
      startIdx + opts.limit < filtered.length
        ? (page[page.length - 1]?.id ?? null)
        : null;
    return { rows: page, nextCursor };
  }

  async getReward(orgId: string, rewardId: string): Promise<RewardRow | null> {
    const rows = await this.db
      .select()
      .from(reward)
      .where(and(eq(reward.organizationId, orgId), eq(reward.id, rewardId)))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Spendable points balance = SUM of the ledger for the customer/org. */
  async pointsBalance(orgId: string, customerId: string): Promise<number> {
    const rows = await this.db
      .select({
        total: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)`,
      })
      .from(pointsTransaction)
      .where(
        and(
          eq(pointsTransaction.organizationId, orgId),
          eq(pointsTransaction.customerId, customerId),
        ),
      );
    return rows[0]?.total ?? 0;
  }

  /** Spendable stamps balance = the active card's `currentStamps` (0 if none). */
  async stampsBalance(orgId: string, customerId: string): Promise<number> {
    const card = await this.activeCard(orgId, customerId);
    return card?.currentStamps ?? 0;
  }

  async balances(orgId: string, customerId: string): Promise<Balances> {
    const [stamps, points] = await Promise.all([
      this.stampsBalance(orgId, customerId),
      this.pointsBalance(orgId, customerId),
    ]);
    return { stamps, points };
  }

  private async activeCard(
    orgId: string,
    customerId: string,
  ): Promise<{ id: string; currentStamps: number } | null> {
    const rows = await this.db
      .select({ id: loyaltyCard.id, currentStamps: loyaltyCard.currentStamps })
      .from(loyaltyCard)
      .where(
        and(
          eq(loyaltyCard.organizationId, orgId),
          eq(loyaltyCard.customerId, customerId),
          eq(loyaltyCard.status, "active"),
        ),
      )
      .orderBy(desc(loyaltyCard.sequence))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Number of times the customer has claimed each reward (for "once"). */
  async claimedCountByReward(
    orgId: string,
    customerId: string,
  ): Promise<Map<string, number>> {
    const rows = await this.db
      .select({
        rewardId: redemption.rewardId,
        count: sql<number>`count(*)`,
      })
      .from(redemption)
      .where(
        and(
          eq(redemption.organizationId, orgId),
          eq(redemption.customerId, customerId),
        ),
      )
      .groupBy(redemption.rewardId);
    return new Map(rows.map((r) => [r.rewardId, r.count]));
  }

  /** Reward ids the customer has ever claimed (for the "redeemed" filter). */
  async claimedRewardIds(
    orgId: string,
    customerId: string,
  ): Promise<Set<string>> {
    const rows = await this.db
      .selectDistinct({ rewardId: redemption.rewardId })
      .from(redemption)
      .where(
        and(
          eq(redemption.organizationId, orgId),
          eq(redemption.customerId, customerId),
        ),
      );
    return new Set(rows.map((r) => r.rewardId));
  }

  /** Most recent redemption time per reward (for the "once" `redeemedAt`). */
  async lastRedeemedAtByReward(
    orgId: string,
    customerId: string,
  ): Promise<Map<string, Date>> {
    const rows = await this.db
      .select({
        rewardId: redemption.rewardId,
        lastAt: sql<Date>`max(${redemption.createdAt})`,
      })
      .from(redemption)
      .where(
        and(
          eq(redemption.organizationId, orgId),
          eq(redemption.customerId, customerId),
        ),
      )
      .groupBy(redemption.rewardId);
    const map = new Map<string, Date>();
    for (const r of rows) {
      if (r.lastAt) map.set(r.rewardId, new Date(r.lastAt));
    }
    return map;
  }

  async recentRedemptions(
    orgId: string,
    customerId: string,
    limit = 3,
  ): Promise<RedemptionHistoryItem[]> {
    return this.redemptionRows(orgId, customerId, { limit });
  }

  async redemptionHistory(
    orgId: string,
    customerId: string,
    opts: { from?: Date; to?: Date; cursor?: string; limit: number },
  ): Promise<{ items: RedemptionHistoryItem[]; nextCursor: string | null }> {
    // Over-fetch one to know whether there's a next page.
    const rows = await this.redemptionRows(orgId, customerId, {
      from: opts.from,
      to: opts.to,
      cursor: opts.cursor,
      limit: opts.limit + 1,
    });
    const hasMore = rows.length > opts.limit;
    const items = hasMore ? rows.slice(0, opts.limit) : rows;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;
    return { items, nextCursor };
  }

  private async redemptionRows(
    orgId: string,
    customerId: string,
    opts: { from?: Date; to?: Date; cursor?: string; limit: number },
  ): Promise<RedemptionHistoryItem[]> {
    const conds = [
      eq(redemption.organizationId, orgId),
      eq(redemption.customerId, customerId),
    ];
    if (opts.from) conds.push(gte(redemption.createdAt, opts.from));
    if (opts.to) conds.push(lte(redemption.createdAt, opts.to));
    // Cursor: createdAt of the last seen row (keyset on the indexed createdAt).
    if (opts.cursor) {
      const c = new Date(opts.cursor);
      if (!Number.isNaN(c.getTime())) conds.push(lt(redemption.createdAt, c));
    }
    const rows = await this.db
      .select({
        id: redemption.id,
        rewardId: redemption.rewardId,
        rewardName: reward.name,
        rewardImageUrl: reward.imageUrl,
        currency: redemption.currency,
        stampsSpent: redemption.stampsSpent,
        pointsSpent: redemption.pointsSpent,
        redeemedAt: redemption.createdAt,
        purchaseId: redemption.purchaseId,
      })
      .from(redemption)
      .innerJoin(reward, eq(redemption.rewardId, reward.id))
      .where(and(...conds))
      .orderBy(desc(redemption.createdAt))
      .limit(opts.limit);
    return rows.map((r) => ({
      id: r.id,
      rewardId: r.rewardId,
      rewardName: r.rewardName,
      rewardImageUrl: r.rewardImageUrl,
      currency: r.currency as "stamps" | "points",
      stampsSpent: r.stampsSpent,
      pointsSpent: r.pointsSpent,
      redeemedAt: r.redeemedAt,
      purchaseId: r.purchaseId,
    }));
  }

  /** Sum of `earn` points within the rolling window — the tier-qualifying total. */
  async pointsTierTotal(orgId: string, customerId: string): Promise<number> {
    const windowStart = new Date(Date.now() - WINDOW_DAYS * DAY_MS);
    const rows = await this.db
      .select({
        total: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)`,
      })
      .from(pointsTransaction)
      .where(
        and(
          eq(pointsTransaction.organizationId, orgId),
          eq(pointsTransaction.customerId, customerId),
          eq(pointsTransaction.type, "earn"),
          gte(pointsTransaction.createdAt, windowStart),
        ),
      );
    return rows[0]?.total ?? 0;
  }

  /** The customer's current tier key (reuses points tier math + window). */
  async tierKey(orgId: string, customerId: string): Promise<string> {
    return currentTierKey(await this.pointsTierTotal(orgId, customerId));
  }

  // ---- availability cycle ---------------------------------------------------

  /** Mark a reward ready for a customer (insert if absent; no-op if present). */
  async upsertAvailable(
    orgId: string,
    customerId: string,
    rewardId: string,
  ): Promise<void> {
    await this.db
      .insert(rewardAvailability)
      .values({
        customerId,
        organizationId: orgId,
        rewardId,
        readyAt: new Date(),
        lastStage: "immediate",
      })
      .onConflictDoNothing();
  }

  async deleteAvailability(customerId: string, rewardId: string): Promise<void> {
    await this.db
      .delete(rewardAvailability)
      .where(
        and(
          eq(rewardAvailability.customerId, customerId),
          eq(rewardAvailability.rewardId, rewardId),
        ),
      );
  }

  /** Availability rows whose readyAt age has crossed past `lastStage` into the
   *  next reminder stage. `now` lets the cron / tests pin the clock. Returns the
   *  row joined with its reward so the notification has the name/cost. */
  async listDueReminders(
    orgId: string,
    stages: { stage: string; afterMs: number }[],
    now = new Date(),
  ): Promise<
    {
      id: string;
      customerId: string;
      rewardId: string;
      rewardName: string;
      readyAt: Date;
      lastStage: string;
      dueStage: string;
    }[]
  > {
    const rows = await this.db
      .select({
        id: rewardAvailability.id,
        customerId: rewardAvailability.customerId,
        rewardId: rewardAvailability.rewardId,
        rewardName: reward.name,
        readyAt: rewardAvailability.readyAt,
        lastStage: rewardAvailability.lastStage,
      })
      .from(rewardAvailability)
      .innerJoin(reward, eq(rewardAvailability.rewardId, reward.id))
      .where(
        and(
          eq(rewardAvailability.organizationId, orgId),
          eq(reward.status, "published"),
        ),
      );

    // Stages ascending by age; the due stage is the latest whose threshold has
    // elapsed AND that's beyond the row's lastStage.
    const ordered = [...stages].sort((a, b) => a.afterMs - b.afterMs);
    const stageRank = new Map(ordered.map((s, i) => [s.stage, i + 1]));
    // "immediate" is rank 0 (the unlock notification already went out).
    stageRank.set("immediate", 0);

    const due: {
      id: string;
      customerId: string;
      rewardId: string;
      rewardName: string;
      readyAt: Date;
      lastStage: string;
      dueStage: string;
    }[] = [];
    for (const row of rows) {
      const age = now.getTime() - row.readyAt.getTime();
      let target: string | null = null;
      for (const s of ordered) {
        if (age >= s.afterMs) target = s.stage;
      }
      if (!target) continue;
      const lastRank = stageRank.get(row.lastStage) ?? 0;
      const targetRank = stageRank.get(target) ?? 0;
      if (targetRank > lastRank) {
        due.push({ ...row, dueStage: target });
      }
    }
    return due;
  }

  async advanceStage(availabilityId: string, stage: string): Promise<void> {
    await this.db
      .update(rewardAvailability)
      .set({ lastStage: stage, updatedAt: new Date() })
      .where(eq(rewardAvailability.id, availabilityId));
  }

  // ---- claim ----------------------------------------------------------------

}

/**
 * Given the customer's points + stamps balances BEFORE and AFTER a purchase,
 * return the rewards that crossed from not-claimable to claimable. Pure (no DB)
 * so the purchase orchestrator can compute it from already-fetched rows.
 */
export function newlyReady(
  rewards: RewardRow[],
  before: Balances,
  after: Balances,
  opts: { tierKey: string; claimedRewardIds: Set<string> },
): RewardRow[] {
  return rewards.filter((rw) => {
    if (rw.status !== "published") return false;
    // Tier gate: locked rewards never become "ready".
    if (rw.allowedTiers && !rw.allowedTiers.includes(opts.tierKey)) return false;
    // "once" already claimed never re-arms.
    if (rw.limitPerCustomer === "once" && opts.claimedRewardIds.has(rw.id)) {
      return false;
    }
    const wasReady = isAffordable(rw, before);
    const isReady = isAffordable(rw, after);
    return !wasReady && isReady;
  });
}

/** Whether `balances` can pay `reward` under its costMode. */
export function isAffordable(
  rw: Pick<RewardRow, "stampsRequired" | "pointsCost" | "costMode">,
  balances: Balances,
): boolean {
  const hasStamps = rw.stampsRequired != null;
  const hasPoints = rw.pointsCost != null;
  const stampsOk = hasStamps ? balances.stamps >= (rw.stampsRequired ?? 0) : false;
  const pointsOk = hasPoints ? balances.points >= (rw.pointsCost ?? 0) : false;
  if (hasStamps && hasPoints) {
    return rw.costMode === "and" ? stampsOk && pointsOk : stampsOk || pointsOk;
  }
  if (hasStamps) return stampsOk;
  if (hasPoints) return pointsOk;
  return false;
}

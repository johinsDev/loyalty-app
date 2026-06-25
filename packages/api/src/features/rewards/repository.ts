import type { db as Db } from "@loyalty/db";
import {
  loyaltyCard,
  pointsTransaction,
  redemption,
  reward,
  type RewardRow,
  rewardAvailability,
} from "@loyalty/db/schema";
import { and, asc, desc, eq, gte, lt, lte, sql } from "drizzle-orm";

import { WINDOW_DAYS } from "../points/config";
import { currentTierKey } from "../points/tier-calc";
import type { RedemptionHistoryItem } from "./schemas";

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
  constructor(private readonly db: typeof Db) {}

  /** Active rewards, ordered by sortOrder then createdAt, cursor-paginated. The
   *  cursor is the last item's `id` (stable within the deterministic order). */
  async listCatalog(
    orgId: string,
    opts: { search?: string; cursor?: string; limit: number },
  ): Promise<{ rows: RewardRow[]; nextCursor: string | null }> {
    const all = await this.db
      .select()
      .from(reward)
      .where(and(eq(reward.organizationId, orgId), eq(reward.active, true)))
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
      .where(eq(rewardAvailability.organizationId, orgId));

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

  /** Transactional claim. Re-checks balance (and once-count) inside the tx, then
   *  deducts the chosen currency/currencies, inserts the redemption row(s), and
   *  deletes the availability row. The balance + once guards double as the
   *  double-claim guard within the token window. */
  async claimTx(input: {
    orgId: string;
    customerId: string;
    reward: RewardRow;
    currency: "stamps" | "points" | "both";
    claimedByUserId: string;
  }): Promise<ClaimTxResult> {
    return this.db.transaction(async (tx) => {
      const { orgId, customerId, reward: rw, currency, claimedByUserId } = input;

      // "once": already claimed → reject (double-claim guard for once rewards).
      if (rw.limitPerCustomer === "once") {
        const prior = await tx
          .select({ id: redemption.id })
          .from(redemption)
          .where(
            and(
              eq(redemption.organizationId, orgId),
              eq(redemption.customerId, customerId),
              eq(redemption.rewardId, rw.id),
            ),
          )
          .limit(1);
        if (prior[0]) return { kind: "already_claimed" as const };
      }

      const payStamps = currency === "stamps" || currency === "both";
      const payPoints = currency === "points" || currency === "both";
      const stampsCost = payStamps ? (rw.stampsRequired ?? 0) : 0;
      const pointsCost = payPoints ? (rw.pointsCost ?? 0) : 0;

      // Deduct stamps: guard currentStamps >= cost via the WHERE clause so a
      // concurrent claim that already drained the balance finds 0 rows.
      let cardId: string | null = null;
      if (stampsCost > 0) {
        const cardRows = await tx
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
        const card = cardRows[0];
        if (!card || card.currentStamps < stampsCost) {
          return { kind: "insufficient" as const };
        }
        const updated = await tx
          .update(loyaltyCard)
          .set({
            currentStamps: card.currentStamps - stampsCost,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(loyaltyCard.id, card.id),
              gte(loyaltyCard.currentStamps, stampsCost),
            ),
          )
          .returning({ id: loyaltyCard.id });
        if (!updated[0]) return { kind: "insufficient" as const };
        cardId = card.id;
      }

      // Deduct points: re-sum inside the tx, then insert a signed redeem row.
      if (pointsCost > 0) {
        const balRows = await tx
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
        const bal = balRows[0]?.total ?? 0;
        if (bal < pointsCost) return { kind: "insufficient" as const };
        await tx.insert(pointsTransaction).values({
          customerId,
          organizationId: orgId,
          type: "redeem",
          points: -pointsCost,
          reason: `reward:${rw.id}`,
          addedByUserId: claimedByUserId,
        });
      }

      // The recorded currency: "both" rewards record as "stamps" (the card was
      // touched) with both *Spent columns set; single-currency records itself.
      const recordedCurrency: "stamps" | "points" =
        currency === "points" ? "points" : "stamps";
      const inserted = await tx
        .insert(redemption)
        .values({
          customerId,
          organizationId: orgId,
          cardId,
          rewardId: rw.id,
          redeemedByUserId: claimedByUserId,
          currency: recordedCurrency,
          stampsSpent: stampsCost,
          pointsSpent: pointsCost,
        })
        .returning({ id: redemption.id });

      // Re-arm: delete the availability row (a repeatable reward re-arms when the
      // balance climbs back over the cost on the next purchase).
      await tx
        .delete(rewardAvailability)
        .where(
          and(
            eq(rewardAvailability.customerId, customerId),
            eq(rewardAvailability.rewardId, rw.id),
          ),
        );

      const [stampsBalance, pointsBalance] = await Promise.all([
        tx
          .select({ s: loyaltyCard.currentStamps })
          .from(loyaltyCard)
          .where(
            and(
              eq(loyaltyCard.organizationId, orgId),
              eq(loyaltyCard.customerId, customerId),
              eq(loyaltyCard.status, "active"),
            ),
          )
          .orderBy(desc(loyaltyCard.sequence))
          .limit(1)
          .then((r) => r[0]?.s ?? 0),
        tx
          .select({
            total: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)`,
          })
          .from(pointsTransaction)
          .where(
            and(
              eq(pointsTransaction.organizationId, orgId),
              eq(pointsTransaction.customerId, customerId),
            ),
          )
          .then((r) => r[0]?.total ?? 0),
      ]);

      return {
        kind: "claimed" as const,
        redemptionId: inserted[0]!.id,
        currency: recordedCurrency,
        stampsSpent: stampsCost,
        pointsSpent: pointsCost,
        stampsBalance,
        pointsBalance,
      };
    });
  }
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
    if (!rw.active) return false;
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

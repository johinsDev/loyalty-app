import type { db as Db } from "@loyalty/db";
import {
  pointsAccount,
  type PointsAccountRow,
  pointsTransaction,
  purchase,
  reward,
} from "@loyalty/db/schema";
import { and, desc, eq, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";

import type { PointsHistoryItem, PointsTransactionItem } from "./schemas";
import { classifyTransaction } from "./transactions";

/**
 * Drizzle access for points. The `points_transaction` ledger is the source of
 * truth (balance + tier-points are SUM queries); `points_account` caches the
 * current tier for transition detection. Only layer that touches the db.
 */
export class PointsRepository {
  constructor(private readonly db: typeof Db) {}

  /** Insert an `earn` row. Idempotent per (org, purchaseId) via the unique
   *  index — a retried purchase returns `false` (already earned). */
  async earn(input: {
    orgId: string;
    customerId: string;
    purchaseId: string;
    storeId: string;
    points: number;
    reason?: string;
  }): Promise<boolean> {
    const inserted = await this.db
      .insert(pointsTransaction)
      .values({
        customerId: input.customerId,
        organizationId: input.orgId,
        type: "earn",
        points: input.points,
        reason: input.reason ?? "purchase",
        purchaseId: input.purchaseId,
        storeId: input.storeId,
      })
      .onConflictDoNothing()
      .returning({ id: pointsTransaction.id });
    return inserted.length > 0;
  }

  /** Insert a signed `adjust` row (manual correction / void reversal). Unlike
   *  `earn` it is never idempotent — each adjustment is a distinct event. */
  async adjust(input: {
    orgId: string;
    customerId: string;
    points: number;
    reason: string;
    purchaseId?: string | null;
    storeId?: string | null;
    addedByUserId?: string | null;
  }): Promise<void> {
    await this.db.insert(pointsTransaction).values({
      customerId: input.customerId,
      organizationId: input.orgId,
      type: "adjust",
      points: input.points,
      reason: input.reason,
      purchaseId: input.purchaseId ?? null,
      storeId: input.storeId ?? null,
      addedByUserId: input.addedByUserId ?? null,
    });
  }

  /** The customer + store a purchase belongs to (org-scoped). */
  async purchaseRef(
    orgId: string,
    purchaseId: string,
  ): Promise<{ customerId: string; storeId: string | null } | null> {
    const rows = await this.db
      .select({ customerId: purchase.customerId, storeId: purchase.storeId })
      .from(purchase)
      .where(and(eq(purchase.organizationId, orgId), eq(purchase.id, purchaseId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async balance(orgId: string, customerId: string): Promise<number> {
    const rows = await this.db
      .select({ total: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)` })
      .from(pointsTransaction)
      .where(
        and(
          eq(pointsTransaction.organizationId, orgId),
          eq(pointsTransaction.customerId, customerId),
        ),
      );
    return rows[0]?.total ?? 0;
  }

  /** Sum of `earn` points since `windowStart` — the tier-qualifying total.
   *  Earns from a voided purchase are excluded (a void reverses tier progress);
   *  standalone earns (no purchaseId) are always included. */
  async tierPoints(
    orgId: string,
    customerId: string,
    windowStart: Date,
  ): Promise<number> {
    const rows = await this.db
      .select({ total: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)` })
      .from(pointsTransaction)
      .leftJoin(purchase, eq(pointsTransaction.purchaseId, purchase.id))
      .where(
        and(
          eq(pointsTransaction.organizationId, orgId),
          eq(pointsTransaction.customerId, customerId),
          eq(pointsTransaction.type, "earn"),
          gte(pointsTransaction.createdAt, windowStart),
          isNull(purchase.voidedAt),
        ),
      );
    return rows[0]?.total ?? 0;
  }

  async account(
    orgId: string,
    customerId: string,
  ): Promise<PointsAccountRow | undefined> {
    const rows = await this.db
      .select()
      .from(pointsAccount)
      .where(
        and(
          eq(pointsAccount.organizationId, orgId),
          eq(pointsAccount.customerId, customerId),
        ),
      )
      .limit(1);
    return rows[0];
  }

  /** Upsert the cached tier state. `nearNotifiedTierKey: null` resets the nudge
   *  dedupe (e.g. when the tier changes). */
  async saveAccount(input: {
    orgId: string;
    customerId: string;
    currentTierKey: string;
    nearNotifiedTierKey: string | null;
  }): Promise<void> {
    await this.db
      .insert(pointsAccount)
      .values({
        customerId: input.customerId,
        organizationId: input.orgId,
        currentTierKey: input.currentTierKey,
        nearNotifiedTierKey: input.nearNotifiedTierKey,
      })
      .onConflictDoUpdate({
        target: pointsAccount.customerId,
        set: {
          currentTierKey: input.currentTierKey,
          nearNotifiedTierKey: input.nearNotifiedTierKey,
          updatedAt: new Date(),
        },
      });
  }

  async history(
    orgId: string,
    customerId: string,
    page: number,
    pageSize: number,
  ): Promise<{ rows: PointsHistoryItem[]; total: number }> {
    const offset = (page - 1) * pageSize;
    const rows = await this.db
      .select({
        id: pointsTransaction.id,
        type: pointsTransaction.type,
        points: pointsTransaction.points,
        reason: pointsTransaction.reason,
        createdAt: pointsTransaction.createdAt,
      })
      .from(pointsTransaction)
      .where(
        and(
          eq(pointsTransaction.organizationId, orgId),
          eq(pointsTransaction.customerId, customerId),
        ),
      )
      .orderBy(desc(pointsTransaction.createdAt))
      .limit(pageSize)
      .offset(offset);

    const count = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(pointsTransaction)
      .where(
        and(
          eq(pointsTransaction.organizationId, orgId),
          eq(pointsTransaction.customerId, customerId),
        ),
      );

    return {
      rows: rows.map((r) => ({
        id: r.id,
        type: r.type as PointsHistoryItem["type"],
        points: r.points,
        reason: r.reason,
        createdAt: r.createdAt,
      })),
      total: count[0]?.value ?? 0,
    };
  }

  /** Cursor-paginated ledger for the dedicated transactions view. Returns the
   *  UI-friendly shape (`kind` + resolved `rewardName`); the raw `reward:<id>`
   *  reason never leaves this layer. Keyset on the indexed `createdAt`; a deleted
   *  reward resolves to `rewardName: null`. */
  async transactions(
    orgId: string,
    customerId: string,
    opts: { from?: Date; to?: Date; cursor?: string; limit: number },
  ): Promise<{ items: PointsTransactionItem[]; nextCursor: string | null }> {
    const conds = [
      eq(pointsTransaction.organizationId, orgId),
      eq(pointsTransaction.customerId, customerId),
    ];
    if (opts.from) conds.push(gte(pointsTransaction.createdAt, opts.from));
    if (opts.to) conds.push(lte(pointsTransaction.createdAt, opts.to));
    if (opts.cursor) {
      const c = new Date(opts.cursor);
      if (!Number.isNaN(c.getTime())) {
        conds.push(lt(pointsTransaction.createdAt, c));
      }
    }

    // Over-fetch one to know whether there's a next page.
    const rows = await this.db
      .select({
        id: pointsTransaction.id,
        type: pointsTransaction.type,
        points: pointsTransaction.points,
        reason: pointsTransaction.reason,
        createdAt: pointsTransaction.createdAt,
        purchaseId: pointsTransaction.purchaseId,
      })
      .from(pointsTransaction)
      .where(and(...conds))
      .orderBy(desc(pointsTransaction.createdAt))
      .limit(opts.limit + 1);

    const hasMore = rows.length > opts.limit;
    const page = hasMore ? rows.slice(0, opts.limit) : rows;

    const classified = page.map((r) => ({
      row: r,
      ...classifyTransaction(r.type, r.reason),
    }));

    // Resolve reward names in one batched query (tolerate deleted rewards).
    const rewardIds = [
      ...new Set(
        classified
          .map((c) => c.rewardId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const names = new Map<string, string>();
    if (rewardIds.length > 0) {
      const rewardRows = await this.db
        .select({ id: reward.id, name: reward.name })
        .from(reward)
        .where(
          and(
            eq(reward.organizationId, orgId),
            inArray(reward.id, rewardIds),
          ),
        );
      for (const rw of rewardRows) names.set(rw.id, rw.name);
    }

    // Resolve purchase amounts (the value shown in a purchase row's detail —
    // there's no product catalog yet) in one batched query.
    const purchaseIds = [
      ...new Set(
        page
          .map((r) => r.purchaseId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const prices = new Map<string, number>();
    if (purchaseIds.length > 0) {
      const purchaseRows = await this.db
        .select({ id: purchase.id, priceCents: purchase.priceCents })
        .from(purchase)
        .where(
          and(
            eq(purchase.organizationId, orgId),
            inArray(purchase.id, purchaseIds),
          ),
        );
      for (const p of purchaseRows) prices.set(p.id, p.priceCents);
    }

    const items: PointsTransactionItem[] = classified.map((c) => ({
      id: c.row.id,
      type: c.row.type as PointsTransactionItem["type"],
      points: c.row.points,
      createdAt: c.row.createdAt,
      kind: c.kind,
      rewardName: c.rewardId ? (names.get(c.rewardId) ?? null) : null,
      priceCents: c.row.purchaseId
        ? (prices.get(c.row.purchaseId) ?? null)
        : null,
    }));

    const nextCursor = hasMore
      ? (page[page.length - 1]?.createdAt.toISOString() ?? null)
      : null;
    return { items, nextCursor };
  }

  /** Customers with any points activity — the cron recomputes each one's tier
   *  (a tier can drop purely because old points aged out of the window). */
  async customersForRecompute(orgId: string): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ customerId: pointsTransaction.customerId })
      .from(pointsTransaction)
      .where(eq(pointsTransaction.organizationId, orgId));
    return rows.map((r) => r.customerId);
  }
}

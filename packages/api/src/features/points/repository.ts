import type { db as Db } from "@loyalty/db";
import {
  pointsAccount,
  type PointsAccountRow,
  pointsTransaction,
} from "@loyalty/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";

import type { PointsHistoryItem } from "./schemas";

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
      })
      .onConflictDoNothing()
      .returning({ id: pointsTransaction.id });
    return inserted.length > 0;
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

  /** Sum of `earn` points since `windowStart` — the tier-qualifying total. */
  async tierPoints(
    orgId: string,
    customerId: string,
    windowStart: Date,
  ): Promise<number> {
    const rows = await this.db
      .select({ total: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)` })
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

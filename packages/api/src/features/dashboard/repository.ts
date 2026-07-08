import type { db as Db } from "@loyalty/db";
import {
  customer,
  purchase,
  redemption,
  reward,
  store,
} from "@loyalty/db/schema";
import { and, desc, eq, gte, lt, sql } from "drizzle-orm";

import {
  computeDeltaPct,
  PERIOD_DAYS,
  type DashboardOverview,
  type DashboardSeriesPoint,
  type KpiStat,
  type Period,
  type RecentPurchaseRow,
  type RecentRedemptionRow,
  type TopCustomerRow,
} from "./schemas";

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function stat(current: number, previous: number): KpiStat {
  return { value: current, deltaPct: computeDeltaPct(current, previous) };
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Drizzle aggregates for the admin dashboard (Tier-1 real stats). */
export class DashboardRepository {
  constructor(private readonly db: typeof Db) {}

  async overview(orgId: string, period: Period, now = new Date()): Promise<DashboardOverview> {
    const days = PERIOD_DAYS[period];
    const curStart = daysAgo(now, days);
    const prevStart = daysAgo(now, days * 2);

    const cnt = sql<number>`count(*)`;
    const revenue = sql<number>`coalesce(sum(${purchase.priceCents}), 0)`;

    const [
      [{ total = 0 } = {}],
      [{ v: membersCur = 0 } = {}],
      [{ v: membersPrev = 0 } = {}],
      [{ v: purchasesCur = 0 } = {}],
      [{ v: purchasesPrev = 0 } = {}],
      [{ v: revenueCur = 0 } = {}],
      [{ v: revenuePrev = 0 } = {}],
      [{ v: redemptionsCur = 0 } = {}],
      [{ v: redemptionsPrev = 0 } = {}],
    ] = await Promise.all([
      this.db.select({ total: cnt }).from(customer).where(eq(customer.organizationId, orgId)),
      this.db
        .select({ v: cnt })
        .from(customer)
        .where(and(eq(customer.organizationId, orgId), gte(customer.createdAt, curStart))),
      this.db
        .select({ v: cnt })
        .from(customer)
        .where(
          and(
            eq(customer.organizationId, orgId),
            gte(customer.createdAt, prevStart),
            lt(customer.createdAt, curStart),
          ),
        ),
      this.db
        .select({ v: cnt })
        .from(purchase)
        .where(and(eq(purchase.organizationId, orgId), gte(purchase.createdAt, curStart))),
      this.db
        .select({ v: cnt })
        .from(purchase)
        .where(
          and(
            eq(purchase.organizationId, orgId),
            gte(purchase.createdAt, prevStart),
            lt(purchase.createdAt, curStart),
          ),
        ),
      this.db
        .select({ v: revenue })
        .from(purchase)
        .where(and(eq(purchase.organizationId, orgId), gte(purchase.createdAt, curStart))),
      this.db
        .select({ v: revenue })
        .from(purchase)
        .where(
          and(
            eq(purchase.organizationId, orgId),
            gte(purchase.createdAt, prevStart),
            lt(purchase.createdAt, curStart),
          ),
        ),
      this.db
        .select({ v: cnt })
        .from(redemption)
        .where(and(eq(redemption.organizationId, orgId), gte(redemption.createdAt, curStart))),
      this.db
        .select({ v: cnt })
        .from(redemption)
        .where(
          and(
            eq(redemption.organizationId, orgId),
            gte(redemption.createdAt, prevStart),
            lt(redemption.createdAt, curStart),
          ),
        ),
    ]);

    return {
      period,
      totalMembers: Number(total),
      members: stat(Number(membersCur), Number(membersPrev)),
      purchases: stat(Number(purchasesCur), Number(purchasesPrev)),
      revenueCents: stat(Number(revenueCur), Number(revenuePrev)),
      redemptions: stat(Number(redemptionsCur), Number(redemptionsPrev)),
      avgTicketCents:
        Number(purchasesCur) === 0 ? 0 : Math.round(Number(revenueCur) / Number(purchasesCur)),
    };
  }

  async series(orgId: string, period: Period, now = new Date()): Promise<DashboardSeriesPoint[]> {
    const days = PERIOD_DAYS[period];
    const start = daysAgo(now, days);
    const [purchases, redemptions] = await Promise.all([
      this.db
        .select({ createdAt: purchase.createdAt })
        .from(purchase)
        .where(and(eq(purchase.organizationId, orgId), gte(purchase.createdAt, start))),
      this.db
        .select({ createdAt: redemption.createdAt })
        .from(redemption)
        .where(and(eq(redemption.organizationId, orgId), gte(redemption.createdAt, start))),
    ]);

    // Pre-seed every day in the window so the chart has no gaps.
    const buckets = new Map<string, { purchases: number; redemptions: number }>();
    for (let i = 0; i < days; i++) {
      buckets.set(isoDay(daysAgo(now, days - 1 - i)), { purchases: 0, redemptions: 0 });
    }
    for (const p of purchases) {
      const b = buckets.get(isoDay(p.createdAt));
      if (b) b.purchases += 1;
    }
    for (const r of redemptions) {
      const b = buckets.get(isoDay(r.createdAt));
      if (b) b.redemptions += 1;
    }
    return [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
  }

  async recentPurchases(orgId: string, limit: number): Promise<RecentPurchaseRow[]> {
    const rows = await this.db
      .select({
        id: purchase.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        amountCents: purchase.priceCents,
        currency: purchase.currency,
        storeName: store.name,
        createdAt: purchase.createdAt,
      })
      .from(purchase)
      .innerJoin(customer, eq(customer.id, purchase.customerId))
      .leftJoin(store, eq(store.id, purchase.storeId))
      .where(eq(purchase.organizationId, orgId))
      .orderBy(desc(purchase.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      customerName: r.customerName?.trim() || r.customerPhone,
      amountCents: r.amountCents,
      currency: r.currency,
      storeName: r.storeName,
      createdAt: r.createdAt,
    }));
  }

  async recentRedemptions(orgId: string, limit: number): Promise<RecentRedemptionRow[]> {
    const rows = await this.db
      .select({
        id: redemption.id,
        rewardName: reward.name,
        rewardIcon: reward.icon,
        customerName: customer.name,
        customerPhone: customer.phone,
        currency: redemption.currency,
        stampsSpent: redemption.stampsSpent,
        pointsSpent: redemption.pointsSpent,
        createdAt: redemption.createdAt,
      })
      .from(redemption)
      .innerJoin(reward, eq(reward.id, redemption.rewardId))
      .leftJoin(customer, eq(customer.id, redemption.customerId))
      .where(eq(redemption.organizationId, orgId))
      .orderBy(desc(redemption.createdAt))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      rewardName: r.rewardName,
      rewardIcon: r.rewardIcon,
      customerName: r.customerName?.trim() || r.customerPhone || "—",
      currency: r.currency,
      stampsSpent: r.stampsSpent,
      pointsSpent: r.pointsSpent,
      createdAt: r.createdAt,
    }));
  }

  async topCustomers(orgId: string, period: Period, limit: number, now = new Date()): Promise<TopCustomerRow[]> {
    const start = daysAgo(now, PERIOD_DAYS[period]);
    const rows = await this.db
      .select({
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        visits: sql<number>`count(${purchase.id})`,
        ltvCents: sql<number>`coalesce(sum(${purchase.priceCents}), 0)`,
      })
      .from(purchase)
      .innerJoin(customer, eq(customer.id, purchase.customerId))
      .where(and(eq(purchase.organizationId, orgId), gte(purchase.createdAt, start)))
      .groupBy(customer.id)
      .orderBy(desc(sql`coalesce(sum(${purchase.priceCents}), 0)`))
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      name: r.name?.trim() || r.phone,
      visits: Number(r.visits),
      ltvCents: Number(r.ltvCents),
    }));
  }
}

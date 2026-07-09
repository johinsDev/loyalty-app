import type { db as Db } from "@loyalty/db";
import {
  customer,
  ingredient,
  loyaltyCard,
  pointsAccount,
  pointsTransaction,
  product,
  purchase,
  purchaseItem,
  redemption,
  reward,
  store,
  streak,
  variantIngredient,
} from "@loyalty/db/schema";
import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";

import {
  computeDeltaPct,
  PERIOD_DAYS,
  type AtRiskRow,
  type CohortsView,
  type FunnelView,
  type DashboardOverview,
  type DashboardSeriesPoint,
  type KpiStat,
  type LoyaltyLiability,
  type Period,
  type RecentPurchaseRow,
  type RecentRedemptionRow,
  type RedemptionEngagement,
  type RetentionStats,
  type StoreSalesRow,
  type TiersView,
  type TopCustomerRow,
  type TopProductRow,
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
        .where(
          and(
            eq(purchase.organizationId, orgId),
            isNull(purchase.voidedAt),
            gte(purchase.createdAt, curStart),
          ),
        ),
      this.db
        .select({ v: cnt })
        .from(purchase)
        .where(
          and(
            eq(purchase.organizationId, orgId),
            isNull(purchase.voidedAt),
            gte(purchase.createdAt, prevStart),
            lt(purchase.createdAt, curStart),
          ),
        ),
      this.db
        .select({ v: revenue })
        .from(purchase)
        .where(
          and(
            eq(purchase.organizationId, orgId),
            isNull(purchase.voidedAt),
            gte(purchase.createdAt, curStart),
          ),
        ),
      this.db
        .select({ v: revenue })
        .from(purchase)
        .where(
          and(
            eq(purchase.organizationId, orgId),
            isNull(purchase.voidedAt),
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
        .where(
        and(
          eq(purchase.organizationId, orgId),
          isNull(purchase.voidedAt),
          gte(purchase.createdAt, start),
        ),
      ),
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
      .where(and(eq(purchase.organizationId, orgId), isNull(purchase.voidedAt)))
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
      .where(
        and(
          eq(purchase.organizationId, orgId),
          isNull(purchase.voidedAt),
          gte(purchase.createdAt, start),
        ),
      )
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

  /** Customers who purchased before but not within `days` — win-back candidates. */
  async atRisk(orgId: string, days: number, limit: number, now = new Date()): Promise<AtRiskRow[]> {
    const rows = await this.db
      .select({ customerId: purchase.customerId, createdAt: purchase.createdAt })
      .from(purchase)
      .where(and(eq(purchase.organizationId, orgId), isNull(purchase.voidedAt)));
    // Last purchase per customer (drizzle returns Date; avoids sql max() ambiguity).
    const last = new Map<string, Date>();
    for (const p of rows) {
      const cur = last.get(p.customerId);
      if (!cur || p.createdAt > cur) last.set(p.customerId, p.createdAt);
    }
    const cutoff = daysAgo(now, days);
    const risky = [...last.entries()]
      .filter(([, d]) => d < cutoff)
      .sort((a, b) => a[1].getTime() - b[1].getTime())
      .slice(0, limit);
    if (risky.length === 0) return [];
    const ids = risky.map(([id]) => id);
    const custs = await this.db
      .select({ id: customer.id, name: customer.name, phone: customer.phone })
      .from(customer)
      .where(inArray(customer.id, ids));
    const byId = new Map(custs.map((c) => [c.id, c]));
    return risky.map(([id, d]) => ({
      id,
      name: byId.get(id)?.name?.trim() || byId.get(id)?.phone || "—",
      lastPurchaseAt: d,
      daysSince: Math.floor((now.getTime() - d.getTime()) / 86400000),
    }));
  }

  /** Repeat rate + visit frequency over the window. */
  async retention(orgId: string, period: Period, now = new Date()): Promise<RetentionStats> {
    const start = daysAgo(now, PERIOD_DAYS[period]);
    const rows = await this.db
      .select({ customerId: purchase.customerId, c: sql<number>`count(*)` })
      .from(purchase)
      .where(
        and(
          eq(purchase.organizationId, orgId),
          isNull(purchase.voidedAt),
          gte(purchase.createdAt, start),
        ),
      )
      .groupBy(purchase.customerId);
    const activeCustomers = rows.length;
    const totalVisits = rows.reduce((s, r) => s + Number(r.c), 0);
    const repeat = rows.filter((r) => Number(r.c) > 1).length;
    return {
      activeCustomers,
      repeatRatePct: activeCustomers === 0 ? 0 : Math.round((repeat / activeCustomers) * 100),
      avgVisits: activeCustomers === 0 ? 0 : Math.round((totalVisits / activeCustomers) * 10) / 10,
    };
  }

  /** Reward-redemption engagement over the window. */
  async redemptionEngagement(
    orgId: string,
    period: Period,
    now = new Date(),
  ): Promise<RedemptionEngagement> {
    const start = daysAgo(now, PERIOD_DAYS[period]);
    const [agg] = await this.db
      .select({
        redemptions: sql<number>`count(*)`,
        redeemers: sql<number>`count(distinct ${redemption.customerId})`,
        discount: sql<number>`coalesce(sum(${redemption.discountCents}), 0)`,
      })
      .from(redemption)
      .where(and(eq(redemption.organizationId, orgId), gte(redemption.createdAt, start)));
    const active = (await this.retention(orgId, period, now)).activeCustomers;
    const redeemers = Number(agg?.redeemers ?? 0);
    return {
      redemptions: Number(agg?.redemptions ?? 0),
      redeemers,
      redeemerRatePct: active === 0 ? 0 : Math.round((redeemers / active) * 100),
      discountCents: Number(agg?.discount ?? 0),
    };
  }

  /** Tier distribution + active streak count. */
  async tiers(orgId: string): Promise<TiersView> {
    const [[{ total = 0 } = {}], accounts, [{ streaks = 0 } = {}]] = await Promise.all([
      this.db
        .select({ total: sql<number>`count(*)` })
        .from(customer)
        .where(eq(customer.organizationId, orgId)),
      this.db
        .select({ key: pointsAccount.currentTierKey, c: sql<number>`count(*)` })
        .from(pointsAccount)
        .where(eq(pointsAccount.organizationId, orgId))
        .groupBy(pointsAccount.currentTierKey),
      this.db
        .select({ streaks: sql<number>`count(*)` })
        .from(streak)
        .where(and(eq(streak.organizationId, orgId), eq(streak.status, "active"))),
    ]);
    const counts = new Map<string, number>();
    for (const a of accounts) {
      if (a.key) counts.set(a.key, Number(a.c));
    }
    const nonBase = [...counts.values()].reduce((s, n) => s + n, 0);
    // Customers with no account (or the base tier) fall into "hoja".
    const base = Math.max(0, Number(total) - nonBase);
    return {
      tiers: [
        { key: "hoja", count: base + (counts.get("hoja") ?? 0) },
        { key: "flor", count: counts.get("flor") ?? 0 },
        { key: "oro", count: counts.get("oro") ?? 0 },
      ],
      activeStreaks: Number(streaks),
    };
  }

  /** The program's outstanding liability + in-window grant/spend of stamps + points. */
  async liability(orgId: string, period: Period, now = new Date()): Promise<LoyaltyLiability> {
    const start = daysAgo(now, PERIOD_DAYS[period]);
    const [[stampsOut], [pointsOut], [earned], [redeemed], [stampsSpent]] = await Promise.all([
      this.db
        .select({ v: sql<number>`coalesce(sum(${loyaltyCard.currentStamps}), 0)` })
        .from(loyaltyCard)
        .where(eq(loyaltyCard.organizationId, orgId)),
      this.db
        .select({ v: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)` })
        .from(pointsTransaction)
        .where(eq(pointsTransaction.organizationId, orgId)),
      this.db
        .select({ v: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)` })
        .from(pointsTransaction)
        .where(
          and(
            eq(pointsTransaction.organizationId, orgId),
            eq(pointsTransaction.type, "earn"),
            gte(pointsTransaction.createdAt, start),
          ),
        ),
      this.db
        .select({ v: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)` })
        .from(pointsTransaction)
        .where(
          and(
            eq(pointsTransaction.organizationId, orgId),
            eq(pointsTransaction.type, "redeem"),
            gte(pointsTransaction.createdAt, start),
          ),
        ),
      this.db
        .select({ v: sql<number>`coalesce(sum(${redemption.stampsSpent}), 0)` })
        .from(redemption)
        .where(and(eq(redemption.organizationId, orgId), gte(redemption.createdAt, start))),
    ]);
    return {
      stampsOutstanding: Number(stampsOut?.v ?? 0),
      pointsOutstanding: Number(pointsOut?.v ?? 0),
      pointsEarned: Number(earned?.v ?? 0),
      pointsRedeemed: Math.abs(Number(redeemed?.v ?? 0)),
      stampsSpent: Number(stampsSpent?.v ?? 0),
    };
  }

  /** Best-selling products (units + revenue) with gross margin from recipe COGS. */
  async topProducts(
    orgId: string,
    period: Period,
    limit: number,
    now = new Date(),
  ): Promise<TopProductRow[]> {
    const start = daysAgo(now, PERIOD_DAYS[period]);
    const lines = await this.db
      .select({
        productId: purchaseItem.productId,
        variantId: purchaseItem.variantId,
        qty: purchaseItem.qty,
        unitAmountCents: purchaseItem.unitAmountCents,
      })
      .from(purchaseItem)
      .innerJoin(purchase, eq(purchase.id, purchaseItem.purchaseId))
      .where(
        and(
          eq(purchase.organizationId, orgId),
          isNull(purchase.voidedAt),
          gte(purchase.createdAt, start),
        ),
      );
    if (lines.length === 0) return [];

    // COGS per variant (Σ qty × ingredient cost) for the sold variants.
    const variantIds = [...new Set(lines.map((l) => l.variantId).filter((x): x is string => !!x))];
    const variantCogs = new Map<string, number>();
    if (variantIds.length > 0) {
      const recipeRows = await this.db
        .select({
          variantId: variantIngredient.variantId,
          cost: sql<number>`sum(${variantIngredient.quantity} * ${ingredient.costPerUnitCents})`,
        })
        .from(variantIngredient)
        .innerJoin(ingredient, eq(ingredient.id, variantIngredient.ingredientId))
        .where(inArray(variantIngredient.variantId, variantIds))
        .groupBy(variantIngredient.variantId);
      for (const r of recipeRows) variantCogs.set(r.variantId, Number(r.cost));
    }

    const agg = new Map<string, { units: number; revenue: number; cogs: number }>();
    for (const l of lines) {
      const cur = agg.get(l.productId) ?? { units: 0, revenue: 0, cogs: 0 };
      cur.units += l.qty;
      cur.revenue += l.qty * l.unitAmountCents;
      cur.cogs += l.qty * (l.variantId ? (variantCogs.get(l.variantId) ?? 0) : 0);
      agg.set(l.productId, cur);
    }
    const top = [...agg.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, limit);
    const ids = top.map(([id]) => id);
    const names = await this.db
      .select({ id: product.id, name: product.name })
      .from(product)
      .where(inArray(product.id, ids));
    const nameById = new Map(names.map((n) => [n.id, n.name]));
    return top.map(([id, v]) => ({
      productId: id,
      name: nameById.get(id) ?? "—",
      units: v.units,
      revenueCents: Math.round(v.revenue),
      cogsCents: Math.round(v.cogs),
      marginPct:
        v.revenue > 0 && v.cogs > 0
          ? Math.round(((v.revenue - v.cogs) / v.revenue) * 100)
          : null,
    }));
  }

  /** Weekly retention cohorts: group customers by their first-purchase week,
   *  then track the % who purchased again in each subsequent week. */
  async cohorts(
    orgId: string,
    cohortsBack = 6,
    weeks = 5,
    now = new Date(),
  ): Promise<CohortsView> {
    const WEEK = 7 * 86_400_000;
    const weekOf = (d: Date) => Math.floor(d.getTime() / WEEK);
    const currentWeek = weekOf(now);

    const rows = await this.db
      .select({ customerId: purchase.customerId, createdAt: purchase.createdAt })
      .from(purchase)
      .where(and(eq(purchase.organizationId, orgId), isNull(purchase.voidedAt)));

    const active = new Map<string, Set<number>>();
    for (const p of rows) {
      let ws = active.get(p.customerId);
      if (!ws) {
        ws = new Set();
        active.set(p.customerId, ws);
      }
      ws.add(weekOf(p.createdAt));
    }

    const byCohort = new Map<number, string[]>();
    for (const [cid, ws] of active) {
      const cohort = Math.min(...ws);
      let members = byCohort.get(cohort);
      if (!members) {
        members = [];
        byCohort.set(cohort, members);
      }
      members.push(cid);
    }

    const chosen = [...byCohort.keys()].sort((a, b) => a - b).slice(-cohortsBack);
    const cohorts = chosen.map((w) => {
      const members = byCohort.get(w)!;
      const size = members.length;
      const retention = Array.from({ length: weeks }, (_, k) =>
        w + k > currentWeek
          ? null
          : Math.round(
              (members.filter((cid) => active.get(cid)!.has(w + k)).length / size) * 100,
            ),
      );
      return { label: new Date(w * WEEK).toISOString().slice(0, 10), size, retention };
    });
    return { weeks, cohorts };
  }

  /** Loyalty funnel over the window: all members → those who purchased → those
   *  who redeemed a reward. */
  async funnel(orgId: string, period: Period, now = new Date()): Promise<FunnelView> {
    const start = daysAgo(now, PERIOD_DAYS[period]);
    const [[members], [purchased], [redeemed]] = await Promise.all([
      this.db
        .select({ v: sql<number>`count(*)` })
        .from(customer)
        .where(eq(customer.organizationId, orgId)),
      this.db
        .select({ v: sql<number>`count(distinct ${purchase.customerId})` })
        .from(purchase)
        .where(
        and(
          eq(purchase.organizationId, orgId),
          isNull(purchase.voidedAt),
          gte(purchase.createdAt, start),
        ),
      ),
      this.db
        .select({ v: sql<number>`count(distinct ${redemption.customerId})` })
        .from(redemption)
        .where(and(eq(redemption.organizationId, orgId), gte(redemption.createdAt, start))),
    ]);
    return {
      stages: [
        { key: "members", value: Number(members?.v ?? 0) },
        { key: "purchased", value: Number(purchased?.v ?? 0) },
        { key: "redeemed", value: Number(redeemed?.v ?? 0) },
      ],
    };
  }

  /** Revenue + sale count per store over the window. */
  async salesByStore(orgId: string, period: Period, now = new Date()): Promise<StoreSalesRow[]> {
    const start = daysAgo(now, PERIOD_DAYS[period]);
    const rows = await this.db
      .select({
        storeId: purchase.storeId,
        name: store.name,
        count: sql<number>`count(*)`,
        revenue: sql<number>`coalesce(sum(${purchase.priceCents}), 0)`,
      })
      .from(purchase)
      .leftJoin(store, eq(store.id, purchase.storeId))
      .where(
        and(
          eq(purchase.organizationId, orgId),
          isNull(purchase.voidedAt),
          gte(purchase.createdAt, start),
        ),
      )
      .groupBy(purchase.storeId)
      .orderBy(desc(sql`coalesce(sum(${purchase.priceCents}), 0)`));
    return rows.map((r) => ({
      storeId: r.storeId,
      name: r.name,
      count: Number(r.count),
      revenueCents: Number(r.revenue),
    }));
  }
}

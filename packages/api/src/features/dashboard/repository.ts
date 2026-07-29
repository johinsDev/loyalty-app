import type { db as Db } from "@loyalty/db";
import {
  category,
  customer,
  ingredient,
  loyaltyCard,
  organization,
  organizationSettings,
  pointsAccount,
  pointsTransaction,
  product,
  productCategory,
  promo,
  purchase,
  purchaseItem,
  redemption,
  reward,
  store,
  streak,
  variantIngredient,
} from "@loyalty/db/schema";
import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";

import {
  computeDeltaPct,
  PERIOD_DAYS,
  type AtRiskRow,
  type CategorySalesRow,
  type CohortsView,
  type FunnelView,
  type NavCounts,
  type SetupChecklist,
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

/** Drizzle aggregates for the admin dashboard (Tier-1 real stats).
 *  `storeId` (set from the active `[storeId]` scope) filters the transactional
 *  aggregates to one store; `null`/undefined = aggregate across all stores
 *  (legacy NULL-store rows included only in the aggregate view). Org-level
 *  aggregates (tiers, cohorts, liability, retention…) ignore it. */
export class DashboardRepository {
  constructor(
    private readonly db: typeof Db,
    private readonly storeId?: string | null,
  ) {}

  /** Extra WHERE conds scoping purchase-based queries to the active store.
   *  Redemptions + member counts stay org-level (wallet is org-wide). */
  private get purchaseStoreCond() {
    return this.storeId ? [eq(purchase.storeId, this.storeId)] : [];
  }

  async overview(orgId: string, period: Period, now = new Date()): Promise<DashboardOverview> {
    const days = PERIOD_DAYS[period];
    const curStart = daysAgo(now, days);
    const prevStart = daysAgo(now, days * 2);

    // Collapsed from 9 single-value queries to 3 grouped ones (one per table).
    // Each window count/sum becomes a `SUM(CASE …)` over the SAME gte/lt
    // conditions the split queries used, so Drizzle encodes the dates identically
    // and the numbers are unchanged. Purchase + redemption gate the scan to
    // `>= prevStart` (both windows live there) → the org_created indexes serve it.
    const inCurC = gte(customer.createdAt, curStart);
    const inPrevC = and(gte(customer.createdAt, prevStart), lt(customer.createdAt, curStart));
    const inCurP = gte(purchase.createdAt, curStart);
    const inPrevP = and(gte(purchase.createdAt, prevStart), lt(purchase.createdAt, curStart));
    const inCurR = gte(redemption.createdAt, curStart);
    const inPrevR = and(gte(redemption.createdAt, prevStart), lt(redemption.createdAt, curStart));
    const purchaseBase = and(
      eq(purchase.organizationId, orgId),
      isNull(purchase.voidedAt),
      ...this.purchaseStoreCond,
    );

    const [
      [{ total = 0, membersCur = 0, membersPrev = 0 } = {}],
      [{ purchasesCur = 0, purchasesPrev = 0, revenueCur = 0, revenuePrev = 0 } = {}],
      [{ redemptionsCur = 0, redemptionsPrev = 0 } = {}],
    ] = await Promise.all([
      this.db
        .select({
          total: sql<number>`count(*)`,
          membersCur: sql<number>`coalesce(sum(case when ${inCurC} then 1 else 0 end), 0)`,
          membersPrev: sql<number>`coalesce(sum(case when ${inPrevC} then 1 else 0 end), 0)`,
        })
        .from(customer)
        .where(eq(customer.organizationId, orgId)),
      this.db
        .select({
          purchasesCur: sql<number>`coalesce(sum(case when ${inCurP} then 1 else 0 end), 0)`,
          purchasesPrev: sql<number>`coalesce(sum(case when ${inPrevP} then 1 else 0 end), 0)`,
          revenueCur: sql<number>`coalesce(sum(case when ${inCurP} then ${purchase.priceCents} else 0 end), 0)`,
          revenuePrev: sql<number>`coalesce(sum(case when ${inPrevP} then ${purchase.priceCents} else 0 end), 0)`,
        })
        .from(purchase)
        .where(and(purchaseBase, gte(purchase.createdAt, prevStart))),
      this.db
        .select({
          redemptionsCur: sql<number>`coalesce(sum(case when ${inCurR} then 1 else 0 end), 0)`,
          redemptionsPrev: sql<number>`coalesce(sum(case when ${inPrevR} then 1 else 0 end), 0)`,
        })
        .from(redemption)
        .where(and(eq(redemption.organizationId, orgId), gte(redemption.createdAt, prevStart))),
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
            ...this.purchaseStoreCond,
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
      .where(and(eq(purchase.organizationId, orgId), isNull(purchase.voidedAt), ...this.purchaseStoreCond))
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
            ...this.purchaseStoreCond,
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
    // Last purchase per customer in ONE grouped query (was: scan all org
    // purchases + last-per-customer in JS + a second id→customer lookup). HAVING
    // the max purchase date fall before the cutoff, oldest-first, joined to the
    // customer. `created_at` is stored as unix seconds, so the max()/cutoff
    // comparison + the returned value go through a seconds integer (drizzle's
    // `max()` drops the timestamp mode).
    const cutoffSec = Math.floor(daysAgo(now, days).getTime() / 1000);
    const lastSec = sql<number>`max(${purchase.createdAt})`;
    const rows = await this.db
      .select({ id: customer.id, name: customer.name, phone: customer.phone, last: lastSec })
      .from(purchase)
      .innerJoin(customer, eq(customer.id, purchase.customerId))
      .where(and(eq(purchase.organizationId, orgId), isNull(purchase.voidedAt), ...this.purchaseStoreCond))
      .groupBy(purchase.customerId)
      .having(sql`max(${purchase.createdAt}) < ${cutoffSec}`)
      .orderBy(asc(lastSec))
      .limit(limit);
    return rows.map((r) => {
      const d = new Date(Number(r.last) * 1000);
      return {
        id: r.id,
        name: r.name?.trim() || r.phone || "—",
        lastPurchaseAt: d,
        daysSince: Math.floor((now.getTime() - d.getTime()) / 86400000),
      };
    });
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
            ...this.purchaseStoreCond,
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
    // The redemption aggregate and `retention` (its own purchase scan) are
    // independent → run them in parallel instead of awaiting sequentially.
    const [aggRows, retention] = await Promise.all([
      this.db
        .select({
          redemptions: sql<number>`count(*)`,
          redeemers: sql<number>`count(distinct ${redemption.customerId})`,
          discount: sql<number>`coalesce(sum(${redemption.discountCents}), 0)`,
        })
        .from(redemption)
        .where(and(eq(redemption.organizationId, orgId), gte(redemption.createdAt, start))),
      this.retention(orgId, period, now),
    ]);
    const agg = aggRows[0];
    const active = retention.activeCustomers;
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
    // The three pointsTransaction sums (all-time outstanding, earned-in-window,
    // redeemed-in-window) fold into one grouped pass via SUM(CASE …) over the
    // same type+date conditions → identical numbers, 5 round-trips down to 3.
    const earnCond = and(eq(pointsTransaction.type, "earn"), gte(pointsTransaction.createdAt, start));
    const redeemCond = and(
      eq(pointsTransaction.type, "redeem"),
      gte(pointsTransaction.createdAt, start),
    );
    const [[stampsOut], [pts], [stampsSpent]] = await Promise.all([
      this.db
        .select({ v: sql<number>`coalesce(sum(${loyaltyCard.currentStamps}), 0)` })
        .from(loyaltyCard)
        .where(eq(loyaltyCard.organizationId, orgId)),
      this.db
        .select({
          pointsOut: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)`,
          earned: sql<number>`coalesce(sum(case when ${earnCond} then ${pointsTransaction.points} else 0 end), 0)`,
          redeemed: sql<number>`coalesce(sum(case when ${redeemCond} then ${pointsTransaction.points} else 0 end), 0)`,
        })
        .from(pointsTransaction)
        .where(eq(pointsTransaction.organizationId, orgId)),
      this.db
        .select({ v: sql<number>`coalesce(sum(${redemption.stampsSpent}), 0)` })
        .from(redemption)
        .where(and(eq(redemption.organizationId, orgId), gte(redemption.createdAt, start))),
    ]);
    return {
      stampsOutstanding: Number(stampsOut?.v ?? 0),
      pointsOutstanding: Number(pts?.pointsOut ?? 0),
      pointsEarned: Number(pts?.earned ?? 0),
      pointsRedeemed: Math.abs(Number(pts?.redeemed ?? 0)),
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

    // COGS per variant (Σ qty × ingredient cost), pre-aggregated as a subquery so
    // the whole thing is ONE query (was: fetch lines → fetch variant COGS →
    // aggregate in JS → fetch product names, 3 sequential round-trips). Join
    // lines → product (name) + variant COGS, group by product, order by revenue.
    const variantCogs = this.db
      .select({
        variantId: variantIngredient.variantId,
        cost: sql<number>`sum(${variantIngredient.quantity} * ${ingredient.costPerUnitCents})`.as(
          "cost",
        ),
      })
      .from(variantIngredient)
      .innerJoin(ingredient, eq(ingredient.id, variantIngredient.ingredientId))
      .groupBy(variantIngredient.variantId)
      .as("variant_cogs");

    const revenue = sql<number>`sum(${purchaseItem.qty} * ${purchaseItem.unitAmountCents})`;
    const rows = await this.db
      .select({
        productId: purchaseItem.productId,
        name: product.name,
        units: sql<number>`sum(${purchaseItem.qty})`,
        revenue,
        cogs: sql<number>`sum(${purchaseItem.qty} * coalesce(${variantCogs.cost}, 0))`,
      })
      .from(purchaseItem)
      .innerJoin(purchase, eq(purchase.id, purchaseItem.purchaseId))
      .leftJoin(product, eq(product.id, purchaseItem.productId))
      .leftJoin(variantCogs, eq(variantCogs.variantId, purchaseItem.variantId))
      .where(
        and(
          eq(purchase.organizationId, orgId),
          isNull(purchase.voidedAt),
          ...this.purchaseStoreCond,
          gte(purchase.createdAt, start),
        ),
      )
      .groupBy(purchaseItem.productId)
      .orderBy(desc(revenue))
      .limit(limit);

    return rows.map((r) => {
      const rev = Number(r.revenue);
      const cogs = Number(r.cogs);
      return {
        productId: r.productId,
        name: r.name ?? "—",
        units: Number(r.units),
        revenueCents: Math.round(rev),
        cogsCents: Math.round(cogs),
        marginPct: rev > 0 && cogs > 0 ? Math.round(((rev - cogs) / rev) * 100) : null,
      };
    });
  }

  /**
   * Revenue mix by **root** category. Two things keep the arithmetic honest:
   *
   * - each product contributes to exactly one category (`is_primary`, falling
   *   back to the lowest `sort_order` so the figures are right even before the
   *   backfill script runs) — otherwise a product filed under two categories
   *   would be counted twice and the slices would exceed 100%;
   * - sub-category sales are folded into their root, because that is the level
   *   the owner thinks in ("how much of the business is Milk Tea?").
   *
   * Slices past `limit` collapse into one "rest" row (`categoryId: null` is
   * reserved for genuinely uncategorised sales, so the caller labels by id).
   */
  async categoryMix(
    orgId: string,
    period: Period,
    limit: number,
    now = new Date(),
  ): Promise<CategorySalesRow[]> {
    const start = daysAgo(now, PERIOD_DAYS[period]);

    const ranked = this.db
      .select({
        productId: productCategory.productId,
        // Fold a leaf into its root; a root is its own bucket.
        rootId: sql<string>`coalesce(${category.parentId}, ${category.id})`.as("root_id"),
        rn: sql<number>`row_number() over (
          partition by ${productCategory.productId}
          order by ${productCategory.isPrimary} desc, ${category.sortOrder} asc
        )`.as("rn"),
      })
      .from(productCategory)
      .innerJoin(category, eq(category.id, productCategory.categoryId))
      .where(eq(category.organizationId, orgId))
      .as("ranked");

    const primaryRoot = this.db
      .select({ productId: ranked.productId, rootId: ranked.rootId })
      .from(ranked)
      .where(eq(ranked.rn, 1))
      .as("primary_root");

    const variantCogs = this.db
      .select({
        variantId: variantIngredient.variantId,
        cost: sql<number>`sum(${variantIngredient.quantity} * ${ingredient.costPerUnitCents})`.as(
          "cost",
        ),
      })
      .from(variantIngredient)
      .innerJoin(ingredient, eq(ingredient.id, variantIngredient.ingredientId))
      .groupBy(variantIngredient.variantId)
      .as("variant_cogs");

    const revenue = sql<number>`sum(${purchaseItem.qty} * ${purchaseItem.unitAmountCents})`;
    const rows = await this.db
      .select({
        categoryId: primaryRoot.rootId,
        name: category.name,
        units: sql<number>`sum(${purchaseItem.qty})`,
        revenue,
        cogs: sql<number>`sum(${purchaseItem.qty} * coalesce(${variantCogs.cost}, 0))`,
      })
      .from(purchaseItem)
      .innerJoin(purchase, eq(purchase.id, purchaseItem.purchaseId))
      .leftJoin(primaryRoot, eq(primaryRoot.productId, purchaseItem.productId))
      .leftJoin(category, eq(category.id, primaryRoot.rootId))
      .leftJoin(variantCogs, eq(variantCogs.variantId, purchaseItem.variantId))
      .where(
        and(
          eq(purchase.organizationId, orgId),
          isNull(purchase.voidedAt),
          ...this.purchaseStoreCond,
          gte(purchase.createdAt, start),
        ),
      )
      // `rootId` is a computed alias, so it needs an explicit SQL reference here.
      .groupBy(sql`${primaryRoot.rootId}`)
      .orderBy(desc(revenue));

    const total = rows.reduce((sum, r) => sum + Number(r.revenue ?? 0), 0);
    const shaped = rows.map((r) => {
      const rev = Math.round(Number(r.revenue ?? 0));
      const cogs = Math.round(Number(r.cogs ?? 0));
      return {
        categoryId: r.categoryId ?? null,
        name: r.name ?? null,
        units: Number(r.units ?? 0),
        revenueCents: rev,
        cogsCents: cogs,
        marginPct: rev > 0 && cogs > 0 ? Math.round(((rev - cogs) / rev) * 100) : null,
        sharePct: total === 0 ? 0 : Math.round((rev / total) * 1000) / 10,
      };
    });

    if (shaped.length <= limit) return shaped;
    const head = shaped.slice(0, limit);
    const rest = shaped.slice(limit);
    const restRevenue = rest.reduce((s, r) => s + r.revenueCents, 0);
    const restCogs = rest.reduce((s, r) => s + r.cogsCents, 0);
    return [
      ...head,
      {
        categoryId: "__rest__",
        name: null,
        units: rest.reduce((s, r) => s + r.units, 0),
        revenueCents: restRevenue,
        cogsCents: restCogs,
        marginPct:
          restRevenue > 0 && restCogs > 0
            ? Math.round(((restRevenue - restCogs) / restRevenue) * 100)
            : null,
        sharePct: total === 0 ? 0 : Math.round((restRevenue / total) * 1000) / 10,
      },
    ];
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
      .where(and(eq(purchase.organizationId, orgId), isNull(purchase.voidedAt), ...this.purchaseStoreCond));

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
            ...this.purchaseStoreCond,
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
            ...this.purchaseStoreCond,
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

  /** Setup checklist — every flag derived from live data, nothing stored. */
  async setupChecklist(orgId: string): Promise<SetupChecklist> {
    const exists = async (q: Promise<{ n: number }[]>) =>
      Number((await q)[0]?.n ?? 0) > 0;
    const [brandRow, settingsRow, products, rewards, promos, stores] = await Promise.all([
      this.db
        .select({ logo: organization.logo })
        .from(organization)
        .where(eq(organization.id, orgId))
        .limit(1),
      this.db
        .select({
          brandColor: organizationSettings.brandColor,
          pointsRates: organizationSettings.pointsRates,
          onboarding: organizationSettings.onboarding,
        })
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, orgId))
        .limit(1),
      exists(
        this.db
          .select({ n: sql<number>`count(*)` })
          .from(product)
          .where(and(eq(product.organizationId, orgId), eq(product.status, "active"))),
      ),
      exists(
        this.db
          .select({ n: sql<number>`count(*)` })
          .from(reward)
          .where(and(eq(reward.organizationId, orgId), eq(reward.status, "published"))),
      ),
      exists(
        this.db
          .select({ n: sql<number>`count(*)` })
          .from(promo)
          .where(and(eq(promo.organizationId, orgId), eq(promo.status, "published"))),
      ),
      exists(
        this.db
          .select({ n: sql<number>`count(*)` })
          .from(store)
          .where(and(eq(store.organizationId, orgId), isNull(store.deletedAt))),
      ),
    ]);
    const s = settingsRow[0];
    return {
      brand: Boolean(brandRow[0]?.logo) && Boolean(s?.brandColor),
      products,
      rewards,
      promos,
      // "Saved at least once" — the loyalty rules card links here until the
      // owner has made the earn rules an explicit decision.
      loyalty: s?.pointsRates != null,
      onboarding: (s?.onboarding?.length ?? 0) > 0,
      store: stores,
    };
  }

  /** Sidebar badges + topbar caption. Three counts, one round trip. */
  async navCounts(orgId: string): Promise<NavCounts> {
    const [customers, promotions, stores] = await Promise.all([
      this.db
        .select({ n: sql<number>`count(*)` })
        .from(customer)
        .where(eq(customer.organizationId, orgId)),
      this.db
        .select({ n: sql<number>`count(*)` })
        .from(promo)
        .where(and(eq(promo.organizationId, orgId), eq(promo.status, "published"))),
      this.db
        .select({ n: sql<number>`count(*)` })
        .from(store)
        .where(and(eq(store.organizationId, orgId), isNull(store.deletedAt))),
    ]);
    return {
      customers: Number(customers[0]?.n ?? 0),
      promotions: Number(promotions[0]?.n ?? 0),
      stores: Number(stores[0]?.n ?? 0),
    };
  }
}

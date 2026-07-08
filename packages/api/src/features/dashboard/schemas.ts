import { z } from "zod";

export const periodSchema = z.enum(["7d", "30d", "90d"]);
export type Period = z.infer<typeof periodSchema>;

export const PERIOD_DAYS: Record<Period, number> = { "7d": 7, "30d": 30, "90d": 90 };

export const overviewInputSchema = z.object({ period: periodSchema.default("30d") });
export const seriesInputSchema = z.object({ period: periodSchema.default("30d") });
export const recentInputSchema = z.object({
  limit: z.number().int().min(1).max(20).default(8),
});
export const topCustomersInputSchema = z.object({
  period: periodSchema.default("30d"),
  limit: z.number().int().min(1).max(20).default(8),
});

/** A KPI figure with its delta vs the immediately-preceding window. */
export interface KpiStat {
  value: number;
  /** Percent change vs the previous window (null when the prior window is 0). */
  deltaPct: number | null;
}

/** Percent change of `current` vs `previous`, 1-decimal; null when prior is 0
 *  (no baseline → no meaningful percentage). Pure so it's unit-testable. */
export function computeDeltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export interface DashboardOverview {
  period: Period;
  members: KpiStat; // new members in the window
  totalMembers: number; // all-time customer count
  purchases: KpiStat; // purchases in the window
  revenueCents: KpiStat; // gross charged (priceCents) in the window
  redemptions: KpiStat; // reward redemptions in the window
  avgTicketCents: number;
}

export interface DashboardSeriesPoint {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  purchases: number;
  redemptions: number;
}

export interface RecentPurchaseRow {
  id: string;
  customerName: string;
  amountCents: number;
  currency: string;
  storeName: string | null;
  createdAt: Date;
}

export interface RecentRedemptionRow {
  id: string;
  rewardName: string;
  rewardIcon: string | null;
  customerName: string;
  currency: string;
  stampsSpent: number;
  pointsSpent: number;
  createdAt: Date;
}

export interface TopCustomerRow {
  id: string;
  name: string;
  visits: number;
  ltvCents: number;
}

// ---- extended stats --------------------------------------------------------
export const atRiskInputSchema = z.object({
  days: z.number().int().min(1).max(365).default(30),
  limit: z.number().int().min(1).max(50).default(8),
});
export const topProductsInputSchema = z.object({
  period: periodSchema.default("30d"),
  limit: z.number().int().min(1).max(50).default(8),
});

/** A customer who hasn't purchased in `days` — a churn/win-back candidate. */
export interface AtRiskRow {
  id: string;
  name: string;
  lastPurchaseAt: Date | null;
  daysSince: number;
}

export interface RetentionStats {
  /** Customers with ≥1 purchase in the window. */
  activeCustomers: number;
  /** % of active customers with more than one purchase in the window. */
  repeatRatePct: number;
  /** Average purchases per active customer in the window. */
  avgVisits: number;
}

export interface RedemptionEngagement {
  redemptions: number;
  redeemers: number;
  /** % of active customers who redeemed at least one reward. */
  redeemerRatePct: number;
  /** Σ reward discount granted (v2 redemption.discountCents). */
  discountCents: number;
}

export interface TierBucket {
  key: string;
  count: number;
}
export interface TiersView {
  tiers: TierBucket[];
  activeStreaks: number;
}

export interface LoyaltyLiability {
  /** Outstanding (unspent) stamps across all cards. */
  stampsOutstanding: number;
  /** Outstanding points balance (Σ ledger). */
  pointsOutstanding: number;
  /** Points earned in the window. */
  pointsEarned: number;
  /** Points redeemed in the window (positive). */
  pointsRedeemed: number;
  /** Stamps spent on reward redemptions in the window. */
  stampsSpent: number;
}

export interface TopProductRow {
  productId: string;
  name: string;
  units: number;
  revenueCents: number;
  /** COGS from the sold variants' recipes (0 when no recipe). */
  cogsCents: number;
  /** (revenue − cogs) / revenue, 0..100; null when no COGS known. */
  marginPct: number | null;
}

export interface StoreSalesRow {
  storeId: string | null;
  name: string | null;
  count: number;
  revenueCents: number;
}

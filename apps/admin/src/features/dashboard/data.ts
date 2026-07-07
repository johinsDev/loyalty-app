/**
 * Hardcoded dashboard sample data — design-first, seams for the Phase D ledger
 * analytics. Revenue/LTV figures assume the optional amount captured at the
 * register (see the plan). RFM mix, retention cohorts and fraud are flagged
 * Beta in the UI (not yet computed).
 */

export type Trend = "up" | "down";

export type Kpi = {
  key: string;
  value: string;
  delta: string;
  trend: Trend;
  sub: string;
  spark: number[];
};

export const kpis: Kpi[] = [
  { key: "activeCustomers", value: "12,847", delta: "+8.2%", trend: "up", sub: "last30d", spark: [38, 42, 40, 46, 50, 48, 55, 60, 58, 66] },
  { key: "returningCustomers", value: "8,124", delta: "+12.4%", trend: "up", sub: "ofTotal", spark: [30, 33, 38, 41, 44, 48, 52, 58, 62, 70] },
  { key: "purchasesTracked", value: "34,210", delta: "+5.8%", trend: "up", sub: "perVisit", spark: [40, 44, 48, 46, 52, 56, 60, 62, 66, 72] },
  { key: "revenueInfluenced", value: "$184.3K", delta: "+14.1%", trend: "up", sub: "loyaltyTied", spark: [28, 34, 40, 45, 52, 58, 63, 70, 78, 88] },
  { key: "rewardsRedeemed", value: "2,489", delta: "+22.6%", trend: "up", sub: "claimRate", spark: [20, 28, 30, 36, 40, 48, 52, 60, 70, 82] },
  { key: "inactiveCustomers", value: "1,204", delta: "-3.1%", trend: "down", sub: "noVisit60d", spark: [60, 58, 55, 54, 50, 48, 46, 44, 41, 38] },
  { key: "avgVisits", value: "4.7", delta: "+0.3", trend: "up", sub: "thisMonth", spark: [40, 42, 44, 45, 47, 48, 50, 52, 54, 56] },
  { key: "loyaltyEngagement", value: "82", delta: "+4", trend: "up", sub: "scoreOf100", spark: [55, 58, 62, 66, 68, 72, 75, 78, 80, 82] },
];

/** Purchases-over-time series (volume), 0–100 normalized for the area chart. */
export const purchasesSeries = [
  42, 50, 47, 55, 60, 53, 58, 62, 50, 58, 64, 61, 70, 75, 82, 88, 84, 92,
];

/** Reward-redemption-trend series. */
export const redemptionSeries = [
  44, 48, 52, 50, 46, 45, 48, 54, 60, 66, 70, 68, 74, 80, 84, 82,
];

/** Daily active users bars (visits & QR scans). */
export const dauBars = [
  62, 70, 74, 76, 75, 76, 72, 70, 71, 73, 78, 82, 84, 86, 84, 82, 80, 82,
];
export const dauAvg = "2,840";

export type EngagementSlice = { key: string; pct: number; color: string };
export const engagementMix: EngagementSlice[] = [
  { key: "champions", pct: 64, color: "var(--primary)" },
  { key: "returning", pct: 22, color: "color-mix(in srgb, var(--primary) 45%, #fff)" },
  { key: "atRisk", pct: 9, color: "#f0a868" },
  { key: "hibernating", pct: 5, color: "#c7cdd4" },
];

export type CohortRow = { label: string; size: number; weeks: (number | null)[] };
export const cohorts: CohortRow[] = [
  { label: "Mar", size: 412, weeks: [100, 72, 58, 49, 42] },
  { label: "Abr", size: 488, weeks: [100, 76, 61, 52, 46] },
  { label: "May", size: 561, weeks: [100, 80, 66, 57, null] },
  { label: "Jun", size: 638, weeks: [100, 83, null, null, null] },
];

export type Purchase = { initials: string; name: string; item: string; amount: string; points: string; store: string; time: string };
export const recentPurchases: Purchase[] = [
  { initials: "AT", name: "Ari Tanaka", item: "Iced Matcha Latte", amount: "$6.25", points: "+12", store: "Centro", time: "2 min" },
  { initials: "LM", name: "Lucía Méndez", item: "Brown Sugar Boba", amount: "$6.75", points: "+14", store: "Norte", time: "4 min" },
  { initials: "NP", name: "Nina Park", item: "Taro Cloud", amount: "$6.50", points: "+13", store: "Centro", time: "7 min" },
  { initials: "SC", name: "Sam Cohen", item: "Thai Milk Tea", amount: "$5.95", points: "+12", store: "Pier 4", time: "9 min" },
];

export type TopCustomer = { initials: string; name: string; visits: number; ltv: string };
export const topCustomers: TopCustomer[] = [
  { initials: "CO", name: "Camila Ortiz", visits: 92, ltv: "$1,840" },
  { initials: "LM", name: "Lucas Medina", visits: 81, ltv: "$1,612" },
  { initials: "AT", name: "Ari Tanaka", visits: 74, ltv: "$1,204" },
  { initials: "MG", name: "María González", visits: 63, ltv: "$1,066" },
];

export type AtRisk = { initials: string; name: string; ago: string };
export const atRisk: AtRisk[] = [
  { initials: "DR", name: "Diego Ruiz", ago: "21 d" },
  { initials: "TV", name: "Tomás Vega", ago: "28 d" },
  { initials: "SQ", name: "Sofía Quiroga", ago: "34 d" },
];

export type FraudAlert = { key: string; severity: "high" | "med"; detail: string; meta: string };
export const fraudAlerts: FraudAlert[] = [
  { key: "rapidScans", severity: "med", detail: "8 sellos en 90 s", meta: "Caja T4 Norte" },
  { key: "rewardReplay", severity: "high", detail: "Mismo código 3×", meta: "Lucas M." },
];

export type RewardClaim = { emoji: string; name: string; by: string; pts: string; ago: string };
export const recentClaims: RewardClaim[] = [
  { emoji: "✨", name: "Topping gratis", by: "Ari T.", pts: "50", ago: "6 min" },
  { emoji: "🧋", name: "Bebida mediana", by: "Camila O.", pts: "400", ago: "22 min" },
  { emoji: "⬆️", name: "Upsize", by: "Lucas M.", pts: "100", ago: "1 h" },
];

/** ROI hero — the sell. */
export const impact = {
  revenue: "$184.3K",
  delta: "+14%",
  multiple: "2.3×",
  planReturn: "188×",
  plan: "$49",
};

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




/** Daily active users bars (visits & QR scans). */
export const dauBars = [
  62, 70, 74, 76, 75, 76, 72, 70, 71, 73, 78, 82, 84, 86, 84, 82, 80, 82,
];
export const dauAvg = "2,840";


export type CohortRow = { label: string; size: number; weeks: (number | null)[] };
export const cohorts: CohortRow[] = [
  { label: "Mar", size: 412, weeks: [100, 72, 58, 49, 42] },
  { label: "Abr", size: 488, weeks: [100, 76, 61, 52, 46] },
  { label: "May", size: 561, weeks: [100, 80, 66, 57, null] },
  { label: "Jun", size: 638, weeks: [100, 83, null, null, null] },
];




export type FraudAlert = { key: string; severity: "high" | "med"; detail: string; meta: string };
export const fraudAlerts: FraudAlert[] = [
  { key: "rapidScans", severity: "med", detail: "8 sellos en 90 s", meta: "Caja T4 Norte" },
  { key: "rewardReplay", severity: "high", detail: "Mismo código 3×", meta: "Lucas M." },
];


/** ROI hero — the sell. */
export const impact = {
  revenue: "$184.3K",
  delta: "+14%",
  multiple: "2.3×",
  planReturn: "188×",
  plan: "$49",
};

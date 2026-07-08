/**
 * Hardcoded analytics sample data — design-first, seams for the Phase D ledger
 * analytics. Growth/revenue/engagement series are 0–100 normalized for the
 * charts; cohorts + funnel mirror the dashboard's beta shapes.
 */

/** New members per month (normalized for the area chart). */
export const growthSeries = [
  28, 34, 31, 40, 46, 52, 49, 58, 64, 61, 70, 78, 84, 90, 88, 96,
];

export type TierKey = "bronze" | "silver" | "gold" | "diamond";
export type TierSlice = { key: TierKey; pct: number; color: string };

export const tierMix: TierSlice[] = [
  { key: "bronze", pct: 48, color: "#b08d57" },
  { key: "silver", pct: 28, color: "#9aa1ab" },
  { key: "gold", pct: 16, color: "#d4a017" },
  { key: "diamond", pct: 8, color: "#1BAD9D" },
];

/** Loyalty-attributed revenue bars (monthly). */
export const revenueBars = [
  52, 58, 55, 62, 68, 64, 72, 78, 74, 82, 88, 94,
];

/** Notification engagement — open vs click rate series. */
export const engagementOpen = [62, 66, 64, 70, 74, 72, 78, 82, 80, 86];
export const engagementClick = [24, 28, 26, 31, 35, 33, 38, 42, 40, 46];





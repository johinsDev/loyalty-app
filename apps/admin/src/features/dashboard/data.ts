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

// The rest of the dashboard is real (dashboard.* tRPC aggregates); only the
// Kpi shape is still shared with the KPI cards.

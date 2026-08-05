import { createLoader, parseAsStringLiteral } from "nuqs/server";

/** Windows the dashboard aggregates support (matches the API `Period`). */
export const DASHBOARD_PERIODS = ["1d", "7d", "30d", "90d"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

/** Days each window covers. `1d` is drawn hourly — see the API's `series.ts`. */
export const DASHBOARD_PERIOD_DAYS: Record<DashboardPeriod, number> = {
  "1d": 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export const dashboardSearchParams = {
  period: parseAsStringLiteral(DASHBOARD_PERIODS).withDefault("30d"),
};

export const loadDashboardSearchParams = createLoader(dashboardSearchParams);

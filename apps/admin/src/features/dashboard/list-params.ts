import { createLoader, parseAsStringLiteral } from "nuqs/server";

/** Windows the dashboard aggregates support (matches the API `Period`). */
export const DASHBOARD_PERIODS = ["7d", "30d", "90d"] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export const dashboardSearchParams = {
  period: parseAsStringLiteral(DASHBOARD_PERIODS).withDefault("30d"),
};

export const loadDashboardSearchParams = createLoader(dashboardSearchParams);

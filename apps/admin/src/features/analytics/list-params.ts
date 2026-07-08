import { createLoader, parseAsStringLiteral } from "nuqs/server";

/** Windows the analytics aggregates support (matches the API `Period`). */
export const ANALYTICS_PERIODS = ["7d", "30d", "90d"] as const;

export const analyticsSearchParams = {
  period: parseAsStringLiteral(ANALYTICS_PERIODS).withDefault("30d"),
};

export const loadAnalyticsSearchParams = createLoader(analyticsSearchParams);

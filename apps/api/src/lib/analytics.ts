import { AnalyticsManager } from "@loyalty/analytics/server";

import { env } from "./env";
import { log } from "./log";

// PostHog when a key is present, else the null provider. posthog-node is
// fetch-based and lazy-loaded on first capture (not at construction).
export const analytics = new AnalyticsManager({
  provider: env.POSTHOG_KEY
    ? { provider: "posthog", apiKey: env.POSTHOG_KEY, host: env.POSTHOG_HOST }
    : { provider: "null" },
  logger: log,
});

import { AnalyticsManager } from "@loyalty/analytics/server";

import { env } from "./env";
import { log } from "./log";

// PostHog (REST via the `fetch` driver — Workers-safe; posthog-node can't run on
// workerd) when a key is present, else the null provider.
export const analytics = new AnalyticsManager({
  provider: env.POSTHOG_KEY
    ? {
        provider: "posthog",
        driver: "fetch",
        apiKey: env.POSTHOG_KEY,
        host: env.POSTHOG_HOST,
      }
    : { provider: "null" },
  logger: log,
});

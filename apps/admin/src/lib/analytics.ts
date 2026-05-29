import { AnalyticsManager } from "@loyalty/analytics/server";

import { env } from "../env";

import { log } from "./log";

/**
 * Bootstrap for `@loyalty/analytics` (server side) in the admin CRM.
 * Mirrors `apps/web/src/lib/analytics.ts`.
 *
 * Provider selection (when `ANALYTICS_PROVIDER` is unset):
 *   - local dev:      null
 *   - preview deploy: null
 *   - production:     posthog
 */
function pickDefaultProvider(): "null" | "posthog" {
  if (env.ANALYTICS_PROVIDER) return env.ANALYTICS_PROVIDER;
  if (process.env.VERCEL_ENV === "production") return "posthog";
  return "null";
}

const wantsPostHog =
  pickDefaultProvider() === "posthog" && !!env.NEXT_PUBLIC_POSTHOG_KEY;

export const analytics = new AnalyticsManager({
  provider: wantsPostHog
    ? {
        provider: "posthog",
        apiKey: env.NEXT_PUBLIC_POSTHOG_KEY!,
        host: env.NEXT_PUBLIC_POSTHOG_HOST,
      }
    : { provider: "null" },
  logger: log,
});

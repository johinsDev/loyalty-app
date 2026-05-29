import { AnalyticsManager } from "@loyalty/analytics/server";

import { env } from "../env";

import { log } from "./log";

/**
 * Bootstrap for `@loyalty/analytics` (server side) in the customer PWA.
 * Bound onto the tRPC context per request — routers call
 * `ctx.analytics?.capture("stamp.earned", { cardId })` without knowing
 * which provider is active. See `.claude/skills/analytics/SKILL.md`.
 *
 * Provider selection (when `ANALYTICS_PROVIDER` is unset):
 *   - local dev:      null      (no events sent)
 *   - preview deploy: null      (keep prod analytics clean)
 *   - production:     posthog   (real events)
 *
 * Override with `ANALYTICS_PROVIDER=null|posthog` per-env. To test in a
 * single preview, pin `ANALYTICS_PROVIDER=posthog` branch-scoped on
 * Vercel — events arrive in PostHog tagged `environment=preview`.
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

import { FlagsManager } from "@loyalty/feature-flags/server";

import { env } from "../env";

import { log } from "./log";

/**
 * Bootstrap for `@loyalty/feature-flags` (server side) in the admin
 * CRM. Mirrors `apps/web/src/lib/feature-flags.ts`.
 *
 * Provider selection (when `FEATURE_FLAGS_PROVIDER` is unset):
 *   - local dev:      null
 *   - preview deploy: posthog
 *   - production:     posthog
 */
function pickDefaultProvider(): "null" | "posthog" {
  if (env.FEATURE_FLAGS_PROVIDER) return env.FEATURE_FLAGS_PROVIDER;
  if (process.env.VERCEL_ENV === "production") return "posthog";
  if (process.env.VERCEL_ENV === "preview") return "posthog";
  return "null";
}

const wantsPostHog =
  pickDefaultProvider() === "posthog" && !!env.NEXT_PUBLIC_POSTHOG_KEY;

export const flags = new FlagsManager({
  provider: wantsPostHog
    ? {
        provider: "posthog",
        apiKey: env.NEXT_PUBLIC_POSTHOG_KEY!,
        host: env.NEXT_PUBLIC_POSTHOG_HOST,
      }
    : { provider: "null" },
  logger: log,
});

import { FlagsManager } from "@loyalty/feature-flags/server";

import { env } from "./env";
import { log } from "./log";

// PostHog flags via the `fetch` driver (REST /decide — Workers-safe) when a key
// is present, else the null provider (caller defaults win).
export const flags = new FlagsManager({
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

import { FlagsManager } from "@loyalty/feature-flags/server";

import { env } from "./env";
import { log } from "./log";

export const flags = new FlagsManager({
  provider: env.POSTHOG_KEY
    ? { provider: "posthog", apiKey: env.POSTHOG_KEY, host: env.POSTHOG_HOST }
    : { provider: "null" },
  logger: log,
});

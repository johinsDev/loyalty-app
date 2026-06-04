import type { CaptureError } from "@loyalty/api";

import { log } from "./log";

// Sentry on Workers uses `@sentry/cloudflare` (a later slice). For now the
// tRPC error-capture hook logs unexpected errors (→ console / Better Stack).
export const captureError: CaptureError = (error, context) => {
  log.error(
    {
      ...context,
      err: error instanceof Error ? error : new Error(String(error)),
    },
    "unhandled API error",
  );
};

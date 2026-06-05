import type { CaptureError } from "@loyalty/api";
import * as Sentry from "@sentry/cloudflare";

import { log } from "./log";

// Unexpected API errors are BOTH logged (→ Better Stack) and captured to Sentry
// via @sentry/cloudflare. `captureException` is a no-op until `withSentry`
// (src/index.ts) initialises Sentry per-request with a DSN, so this is safe when
// SENTRY_DSN is unset — errors then only log.
export const captureError: CaptureError = (error, context) => {
  const err = error instanceof Error ? error : new Error(String(error));
  log.error({ ...context, err }, "unhandled API error");
  Sentry.captureException(err, {
    tags: {
      ...(context?.path && { trpcPath: context.path }),
      ...(context?.type && { trpcType: context.type }),
    },
    ...(context?.userId && { user: { id: context.userId } }),
  });
};

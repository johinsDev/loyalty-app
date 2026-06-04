import type { CaptureError } from "@loyalty/api";
import * as Sentry from "@sentry/nextjs";

/**
 * Server-side error-capture hook bound to the tRPC context
 * (`ctx.captureError`). The `withErrorCapture` middleware in @loyalty/api
 * calls it only for unexpected errors. User context is attached per-event
 * (not via global `setUser`) so concurrent requests in the same server
 * runtime never leak identities. No-op when Sentry is uninitialized (DSN
 * unset). See `.claude/skills/sentry/SKILL.md`.
 */
export const captureError: CaptureError = (error, context) => {
  Sentry.captureException(error, {
    ...(context?.userId && { user: { id: context.userId } }),
    tags: {
      ...(context?.path && { trpcPath: context.path }),
      ...(context?.type && { trpcType: context.type }),
    },
  });
};

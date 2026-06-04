import * as Sentry from "@sentry/nextjs";

// Server + edge Sentry init. Gated on the DSN: unset (local dev) → inert.
// The browser SDK is initialized separately in `instrumentation-client.ts`.
// Errors-only to start — perf/latency lives in Better Stack, so tracing is
// off (revisit if we want distributed traces). See
// `.claude/skills/sentry/SKILL.md`.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function register() {
  if (!dsn) return;

  const runtime = process.env.NEXT_RUNTIME;
  if (runtime !== "nodejs" && runtime !== "edge") return;

  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0,
  });
}

// Captures errors thrown in nested React Server Components / route handlers
// that Next surfaces through this hook. No-op when Sentry isn't initialized.
export const onRequestError = Sentry.captureRequestError;

import * as Sentry from "@sentry/nextjs";

// Browser Sentry init (Next 15.3+/16 replaces sentry.client.config.ts).
// Gated on the public DSN: unset → inert. Errors-only — replay + tracing
// stay off to keep us within the free tier. See
// `.claude/skills/sentry/SKILL.md`.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
  });
}

// Instruments App Router client-side navigations.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

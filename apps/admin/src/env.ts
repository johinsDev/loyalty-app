import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Typed + validated env for the admin CRM.
 *
 * The admin CRM is a thin client of the standalone API Worker
 * (`api.t4diverclub.app`): all backend providers (db, auth, storage, cache,
 * realtime, sms/email/whatsapp/push, analytics, feature flags) run on the
 * Worker, so their env vars no longer live here. What remains is the logging
 * channel, Sentry build-time config, the outbox endpoint gate, and the public
 * `NEXT_PUBLIC_*` browser config.
 */

export const env = createEnv({
  server: {
    BETTER_AUTH_URL: z.string().url().optional(),

    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .optional(),
    LOG_CHANNEL: z
      .enum(["pino", "console", "silent", "better-stack"])
      .optional(),

    BETTER_STACK_SOURCE_TOKEN_ADMIN: z.string().optional(),
    BETTER_STACK_INGESTING_HOST_ADMIN: z.string().optional(),
    BETTER_STACK_SOURCE_TOKEN: z.string().optional(),
    BETTER_STACK_INGESTING_HOST: z.string().optional(),

    // Sentry error tracking. Browser DSN is in the client block
    // (NEXT_PUBLIC_SENTRY_DSN); these three are build-time only, read by
    // `withSentryConfig` to upload source maps during `next build`. All
    // optional: unset → Sentry is inert (local dev). AUTH_TOKEN is build-time,
    // so keep it Plain Text (not Sensitive) in Vercel.
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),

    // Gates the admin *-outbox endpoints (which proxy to the Worker). Outside
    // production they are on; flip to "true" to expose them in a prod pinch.
    WHATSAPP_OUTBOX_ENDPOINT_ENABLED: z
      .enum(["true", "false"])
      .optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    // Standalone API Worker URL (e.g. https://api.t4diverclub.app). When set,
    // the tRPC + auth clients target it cross-origin; unset → same-origin Next
    // routes (current behaviour). See the `api-worker` plan.
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
    NEXT_PUBLIC_PARTYKIT_HOST: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
    // Sentry browser DSN (public). Browser + server SDKs both read it.
    // Unset → Sentry is inert. See `.claude/skills/sentry/SKILL.md`.
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
    // Public R2 image host (no protocol). With NEXT_PUBLIC_API_URL, the custom
    // loader rewrites R2-hosted `<Image>` src to the Worker's `/img` transform
    // endpoint (webp/avif via `cf.image`). Loader no-ops when unset. See
    // `.claude/skills/image-loader/SKILL.md`.
    NEXT_PUBLIC_IMAGE_CDN_HOST: z.string().optional(),
  },
  experimental__runtimeEnv: {
    ...process.env,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_PARTYKIT_HOST: process.env.NEXT_PUBLIC_PARTYKIT_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_IMAGE_CDN_HOST: process.env.NEXT_PUBLIC_IMAGE_CDN_HOST,
  },
  emptyStringAsUndefined: true,
});

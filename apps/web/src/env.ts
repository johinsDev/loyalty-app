import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Typed + validated env for the customer PWA. Imported by `lib/log.ts`
 * at module load — validation runs once, on first import, and fails the
 * boot if anything is missing or shaped wrong.
 *
 * The PWA is a thin client of the standalone API Worker
 * (`api.t4diverclub.app`): all backend providers (db, storage, cache,
 * realtime, sms/email/whatsapp/push, analytics, feature flags) run on the
 * Worker, so their env vars no longer live here. What remains is the
 * logging channel + the public `NEXT_PUBLIC_*` browser config.
 */

export const env = createEnv({
  server: {
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
      .optional(),
    LOG_CHANNEL: z
      .enum(["pino", "console", "silent", "better-stack"])
      .optional(),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().optional(),
    // Standalone API Worker URL (e.g. https://api.t4diverclub.app). When set,
    // the tRPC + auth clients target it cross-origin; unset → same-origin Next
    // routes (current behaviour). See the `api-worker` plan.
    NEXT_PUBLIC_API_URL: z.string().url().optional(),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().optional(),
    NEXT_PUBLIC_PARTYKIT_HOST: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
    // Sentry browser DSN (public, safe to ship to the client). Both the
    // browser and server SDKs read it. Unset → Sentry is inert. See
    // `.claude/skills/sentry/SKILL.md`.
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
    // Host (no protocol) for the Cloudflare zone with Image Transformations
    // enabled. When set, the custom image loader rewrites `<Image>` src
    // through `/cdn-cgi/image/...`. Set only in prod Infisical — dev/preview
    // leave it unset for a no-op loader. See
    // `.claude/skills/image-loader/SKILL.md`.
    NEXT_PUBLIC_IMAGE_CDN_HOST: z.string().optional(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    NEXT_PUBLIC_PARTYKIT_HOST: process.env.NEXT_PUBLIC_PARTYKIT_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_IMAGE_CDN_HOST: process.env.NEXT_PUBLIC_IMAGE_CDN_HOST,
  },
  emptyStringAsUndefined: true,
});

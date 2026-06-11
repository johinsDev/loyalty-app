// Worker env. With `nodejs_compat`, wrangler `vars` + secrets populate
// `process.env`, so these bootstraps read it the same way the Next apps read
// their env — except provider selection keys off the **presence of creds**
// (there is no `VERCEL_ENV` on Workers). Object bindings (e.g. a native R2
// bucket) are NOT here — those come via the Worker `env` arg, threaded in a
// later slice.
const e = process.env as Record<string, string | undefined>;

export const env = {
  // runtime env tag (set in wrangler [vars]; no VERCEL_ENV on Workers). Used to
  // stamp logs + analytics events with preview/production. See baseProperties.
  APP_ENV: e.APP_ENV,
  // rate-limit (Upstash REST)
  UPSTASH_REDIS_REST_URL: e.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: e.UPSTASH_REDIS_REST_TOKEN,
  CACHE_KEY_PREFIX: e.CACHE_KEY_PREFIX,
  // realtime (PartyKit)
  PARTYKIT_HOST: e.PARTYKIT_HOST,
  PARTYKIT_PROJECT: e.PARTYKIT_PROJECT,
  REALTIME_AUTH_SECRET: e.REALTIME_AUTH_SECRET,
  REALTIME_ROOM_PREFIX: e.REALTIME_ROOM_PREFIX,
  // analytics / flags (PostHog)
  POSTHOG_KEY: e.NEXT_PUBLIC_POSTHOG_KEY ?? e.POSTHOG_KEY,
  POSTHOG_HOST: e.NEXT_PUBLIC_POSTHOG_HOST ?? e.POSTHOG_HOST,
  // log (Better Stack HTTP — per-service token preferred)
  BETTER_STACK_SOURCE_TOKEN:
    e.BETTER_STACK_SOURCE_TOKEN_API ?? e.BETTER_STACK_SOURCE_TOKEN,
  BETTER_STACK_INGESTING_HOST:
    e.BETTER_STACK_INGESTING_HOST_API ?? e.BETTER_STACK_INGESTING_HOST,
  LOG_LEVEL: e.LOG_LEVEL,
  // storage (R2 over the S3 API; native binding is a later slice)
  R2_ACCOUNT_ID: e.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: e.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: e.R2_SECRET_ACCESS_KEY,
  R2_BUCKET: e.R2_BUCKET,
  R2_PUBLIC_URL: e.R2_PUBLIC_URL,
  STORAGE_KEY_PREFIX: e.STORAGE_KEY_PREFIX,
  STORAGE_BASE_URL: e.STORAGE_BASE_URL,
  // Sentry (@sentry/cloudflare). A dedicated SENTRY_DSN for the api project, or
  // the browser DSN as a fallback. Unset → Sentry is inert (errors only log).
  SENTRY_DSN: e.SENTRY_DSN ?? e.NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_ENVIRONMENT: e.SENTRY_ENVIRONMENT,
  // Release id for grouping + source-map symbolication. Falls back to
  // SENTRY_ENVIRONMENT-less default (undefined → no release tag).
  SENTRY_RELEASE: e.SENTRY_RELEASE,
} as const;

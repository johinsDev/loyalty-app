import type { BaseProperties } from "@loyalty/analytics";

import type { Context } from "./trpc";

const UNKNOWN_IP = "unknown";

/**
 * Best client IP from the request headers. On Vercel/Cloudflare the
 * real client is the first hop of `x-forwarded-for`; fall back to
 * `x-real-ip`. Never trust a body-supplied IP.
 *
 * NOTE: duplicates the helper that will land with the `rate-limit`
 * package (PR #67). Will consolidate when that merges.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? UNKNOWN_IP;
}

/**
 * Per-request distinct id. Authenticated users get their RAW user id —
 * the same value the browser passes to `posthog.identify(userId)` (see
 * the `@loyalty/analytics` react provider), so server- and client-side
 * events + flag evaluations resolve to ONE PostHog person: consistent
 * A-B bucketing and merged event attribution. Anonymous callers get
 * `anon:<ip>` — best PostHog can do server-side without the posthog-js
 * cookie.
 */
export function resolveDistinctId(ctx: Context): string {
  const userId = ctx.session?.user?.id;
  if (userId) return userId;
  return `anon:${getClientIp(ctx.headers)}`;
}

/**
 * Base props baked onto every event. The `app` is set by the app
 * itself (the only thing this helper can't infer). Locale is read
 * from the `x-locale` header if set; otherwise omitted.
 */
export function baseProperties(
  ctx: Context,
  app: BaseProperties["app"],
): BaseProperties {
  return {
    app,
    environment: process.env.VERCEL_ENV ?? "development",
    locale: ctx.headers.get("x-locale") ?? undefined,
  };
}

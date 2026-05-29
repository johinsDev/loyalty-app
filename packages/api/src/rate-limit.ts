import type { Duration } from "@loyalty/rate-limit";

import type { Context } from "./trpc";

/**
 * How a rate-limit rule derives its bucket key:
 *   - `"user"`       → `user:<id>` (null when unauthenticated → skipped)
 *   - `"ip"`         → `ip:<client ip>`
 *   - `"ipOrUser"`   → user id if signed in, else ip (the default)
 *   - a function     → anything, e.g. phone: `(_, i) => `phone:${i.phoneNumber}``
 *     (return `null` to skip — e.g. the field is absent)
 */
export type RateLimitKey =
  | "ip"
  | "user"
  | "ipOrUser"
  | ((
      ctx: Context,
      rawInput: unknown,
    ) => string | null | Promise<string | null>);

export interface RateLimitOptions {
  /** Max requests allowed per `window`. */
  limit: number;
  /** Window length (`"1m"`, `"10s"`, …) or raw seconds. */
  window: Duration | number;
  /** Bucket key strategy. Default `"ipOrUser"`. */
  by?: RateLimitKey;
  /**
   * Names the counter so this rule doesn't share a bucket with the
   * baseline or other rules on the same procedure. Default `"default"`.
   */
  name?: string;
}

const UNKNOWN_IP = "unknown";

/**
 * Best client IP from the request headers. On Vercel/Cloudflare the
 * real client is the first hop of `x-forwarded-for`; fall back to
 * `x-real-ip`. Never trust a body-supplied IP.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? UNKNOWN_IP;
}

export async function resolveKey(
  by: RateLimitKey,
  ctx: Context,
  rawInput: unknown,
): Promise<string | null> {
  if (typeof by === "function") return by(ctx, rawInput);
  const userId = ctx.session?.user?.id;
  switch (by) {
    case "user":
      return userId ? `user:${userId}` : null;
    case "ip":
      return `ip:${getClientIp(ctx.headers)}`;
    case "ipOrUser":
      return userId ? `user:${userId}` : `ip:${getClientIp(ctx.headers)}`;
  }
}

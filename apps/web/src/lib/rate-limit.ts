import { RateLimiter, type ProviderConfig } from "@loyalty/rate-limit";

import { env } from "../env";

import { log } from "./log";

/**
 * Bootstrap for `@loyalty/rate-limit` in the customer PWA. One module,
 * bound onto the tRPC context so the `rateLimit` middleware can throttle
 * abusive callers. See `.claude/skills/rate-limit/SKILL.md`.
 *
 * Provider selection (default if `RATE_LIMIT_PROVIDER` is unset):
 *   - local dev:      memory  (process-local; NOT shared across instances)
 *   - preview deploy: upstash (REST → atomic across serverless instances)
 *   - production:     upstash (same)
 *
 * Memory is wrong for serverless prod (each lambda counts on its own),
 * so default to upstash there. Reuses the same Upstash creds + the
 * per-PR `CACHE_KEY_PREFIX` namespace as `@loyalty/cache`.
 */
function pickDefaultProvider(): "memory" | "upstash" | "redis" {
  if (env.RATE_LIMIT_PROVIDER) return env.RATE_LIMIT_PROVIDER;
  if (process.env.VERCEL_ENV === "production") return "upstash";
  if (process.env.VERCEL_ENV === "preview") return "upstash";
  return "memory";
}

const upstashConfig: ProviderConfig | undefined =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? {
        provider: "upstash",
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      }
    : undefined;

const redisConfig: ProviderConfig | undefined = env.REDIS_URL
  ? { provider: "redis", url: env.REDIS_URL }
  : undefined;

export const rateLimiter = new RateLimiter({
  default: pickDefaultProvider(),
  stores: {
    memory: { provider: "memory" },
    upstash: upstashConfig,
    redis: redisConfig,
  },
  // Per-PR isolation in previews (reuses the cache prefix, e.g. `pr-7:`);
  // empty in prod/dev → no prefix.
  namespace: env.CACHE_KEY_PREFIX,
  logger: log,
});

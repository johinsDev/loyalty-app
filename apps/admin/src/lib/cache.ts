import { CacheManager, type ProviderConfig } from "@loyalty/cache";

import { env } from "../env";

import { log } from "./log";

/**
 * Bootstrap for `@loyalty/cache` in the staff CRM. Mirror of the web
 * app's bootstrap; see `apps/web/src/lib/cache.ts` for the cascade.
 */
function pickDefaultProvider(): "memory" | "upstash" | "redis" {
  if (env.CACHE_PROVIDER) return env.CACHE_PROVIDER;
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

export const cache = new CacheManager({
  default: pickDefaultProvider(),
  stores: {
    memory: { provider: "memory" },
    upstash: upstashConfig,
    redis: redisConfig,
  },
  // Preview: per-PR namespace (CACHE_KEY_PREFIX=pr-<n>:) + a default TTL so a
  // shared Upstash never fills up. Both empty/undefined elsewhere → no-op.
  keyPrefix: env.CACHE_KEY_PREFIX,
  defaultTtlSeconds: env.CACHE_DEFAULT_TTL,
  logger: log,
});

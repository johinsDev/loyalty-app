import { CacheManager, type ProviderConfig } from "@loyalty/cache";

import { env } from "../env";

import { log } from "./log";

/**
 * Bootstrap for `@loyalty/cache` in the customer PWA. One module,
 * imported anywhere via `import { cache } from "@/lib/cache"`.
 *
 * Provider selection (default if `CACHE_PROVIDER` is unset):
 *   - local dev:        memory (process-local, no network)
 *   - Vercel preview:   upstash (serverless-friendly REST)
 *   - Vercel prod:      upstash (same — REST survives cold starts)
 *
 * Override with `CACHE_PROVIDER=memory|upstash|redis`. The redis
 * provider is mostly for self-hosted environments + jobs that keep
 * a persistent connection.
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
  logger: log,
});

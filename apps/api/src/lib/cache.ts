import { CacheManager, type UpstashProviderConfig } from "@loyalty/cache";

import { env } from "./env";
import { log } from "./log";

// Read-through cache for the rewards catalog (and future read paths). Upstash
// REST when creds are present (Workers-safe), else in-memory (process-local;
// fine for local/preview). Mirrors the rate-limiter provider selection — there
// is no VERCEL_ENV on Workers, so we key off the presence of creds.
const upstash: UpstashProviderConfig | undefined =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? {
        provider: "upstash",
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      }
    : undefined;

export const cache = new CacheManager({
  default: upstash ? "upstash" : "memory",
  stores: {
    memory: { provider: "memory" },
    upstash,
  },
  keyPrefix: env.CACHE_KEY_PREFIX,
  logger: log,
});

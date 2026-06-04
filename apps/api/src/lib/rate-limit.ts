import { RateLimiter, type ProviderConfig } from "@loyalty/rate-limit";

import { env } from "./env";
import { log } from "./log";

// Upstash REST when creds are present (Workers-safe), else in-memory
// (process-local; fine for local/preview). ioredis is never selected here.
const upstash: ProviderConfig | undefined =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? {
        provider: "upstash",
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      }
    : undefined;

export const rateLimiter = new RateLimiter({
  default: upstash ? "upstash" : "memory",
  stores: {
    memory: { provider: "memory" },
    upstash,
  },
  namespace: env.CACHE_KEY_PREFIX,
  logger: log,
});

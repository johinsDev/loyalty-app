import { MissingDependencyError, ProviderError } from "../errors";
import {
  parseDuration,
  type RateLimitProvider,
  type RateLimitResult,
  type RateLimitRule,
  type UpstashProviderConfig,
} from "../types";
import { dynamicImport } from "./_lazy";

/**
 * Upstash rate limiter — built on `@upstash/ratelimit` + `@upstash/redis`
 * (REST, serverless-friendly, atomic sliding window). **Default for
 * preview + production.** Lazy-loads both packages on first use.
 *
 * `@upstash/ratelimit` binds the limit + window at construction, so we
 * keep one `Ratelimit` instance per distinct `(limit, window)` rule.
 */
export class UpstashProvider implements RateLimitProvider {
  readonly name = "upstash";
  readonly #config: UpstashProviderConfig;
  readonly #limiters = new Map<string, RatelimitLike>();
  #redis: unknown;
  #ratelimitCtor: RatelimitCtor | undefined;

  constructor(config: UpstashProviderConfig) {
    this.#config = config;
  }

  async #getRedis(): Promise<unknown> {
    if (this.#redis) return this.#redis;
    let mod: {
      Redis: {
        fromEnv: () => unknown;
        new (init: { url: string; token: string }): unknown;
      };
    };
    try {
      mod = (await dynamicImport("@upstash/redis")) as unknown as typeof mod;
    } catch {
      throw new MissingDependencyError("upstash", "@upstash/redis");
    }
    this.#redis =
      this.#config.url && this.#config.token
        ? new mod.Redis({ url: this.#config.url, token: this.#config.token })
        : mod.Redis.fromEnv();
    return this.#redis;
  }

  async #getCtor(): Promise<RatelimitCtor> {
    if (this.#ratelimitCtor) return this.#ratelimitCtor;
    let mod: { Ratelimit: RatelimitCtor };
    try {
      mod = (await dynamicImport(
        "@upstash/ratelimit",
      )) as unknown as typeof mod;
    } catch {
      throw new MissingDependencyError("upstash", "@upstash/ratelimit");
    }
    this.#ratelimitCtor = mod.Ratelimit;
    return this.#ratelimitCtor;
  }

  async #getLimiter(rule: RateLimitRule): Promise<RatelimitLike> {
    const windowSeconds = parseDuration(rule.window);
    const cacheKey = `${rule.limit}:${windowSeconds}`;
    const existing = this.#limiters.get(cacheKey);
    if (existing) return existing;

    const Ratelimit = await this.#getCtor();
    const redis = await this.#getRedis();
    const limiter = new Ratelimit({
      redis,
      // `${n} s` is the duration format @upstash/ratelimit expects.
      limiter: Ratelimit.slidingWindow(rule.limit, `${windowSeconds} s`),
      prefix: "@loyalty/rl",
      analytics: false,
    });
    this.#limiters.set(cacheKey, limiter);
    return limiter;
  }

  async limit(key: string, rule: RateLimitRule): Promise<RateLimitResult> {
    try {
      const limiter = await this.#getLimiter(rule);
      const res = await limiter.limit(key);
      return {
        success: res.success,
        limit: res.limit,
        remaining: res.remaining,
        resetAt: res.reset,
      };
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw new ProviderError(this.name, asMessage(error), error);
    }
  }
}

/** Narrow structural types — keep the real packages out of the build graph. */
interface RatelimitLike {
  limit(id: string): Promise<{
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
  }>;
}

interface RatelimitCtor {
  new (config: {
    redis: unknown;
    limiter: unknown;
    prefix?: string;
    analytics?: boolean;
  }): RatelimitLike;
  slidingWindow(tokens: number, window: string): unknown;
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

import {
  auth,
  getUserRole,
  MANAGER_OR_ABOVE,
  OWNER_ONLY,
  STAFF_OR_ABOVE,
  type Role,
  type Session,
} from "@loyalty/auth/server";
import type { AnalyticsBinding } from "@loyalty/analytics";
import { db } from "@loyalty/db";
import type { RateLimitResult, RateLimitRule } from "@loyalty/rate-limit";
import type { FakeRealtime, RealtimeClient } from "@loyalty/realtime";
import type { StorageDisk } from "@loyalty/storage";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import {
  getClientIp,
  resolveKey,
  type RateLimitOptions,
} from "./rate-limit";

/**
 * Structural slice of the realtime client. Apps bind either a real
 * `RealtimeClient` (prod) or `FakeRealtime` (dev / preview without
 * partykit configured); both satisfy this shape, so router code stays
 * unaware of the provider.
 */
export type RealtimeBinding = Pick<RealtimeClient, "publish"> &
  Partial<Pick<FakeRealtime, "published">>;

/**
 * Structural slice of `StorageManager`. Apps bind their configured
 * instance regardless of how many disks they declare — the router only
 * cares about `.disk(name?)`. Avoiding the generic in `Context` keeps
 * `apps/{web,admin}` free of TS variance gripes.
 */
export interface StorageBinding {
  disk(name?: string): StorageDisk;
}

/**
 * Structural slice of `RateLimiter`. Apps bind their configured
 * instance (memory in dev, upstash in preview/prod). Optional so CLI
 * scripts + tests run unthrottled — the middleware fails open when it's
 * absent. See `.claude/skills/rate-limit/SKILL.md`.
 */
export interface RateLimiterBinding {
  limit(key: string, rule: RateLimitRule): Promise<RateLimitResult>;
}

export type Context = {
  db: typeof db;
  session: Session | null;
  headers: Headers;
  rateLimiter?: RateLimiterBinding;
  /**
   * Bound by the app's `createContext` factory. Routers that publish
   * realtime events read from here so they don't import the
   * bootstrap singleton (which would create a packages/api → app cycle).
   * Optional because some tools (CLI scripts, tests) don't need it.
   */
  realtime?: RealtimeBinding;
  /**
   * Storage manager. Same pattern as `realtime` — apps bind a
   * configured `StorageManager` so the storage router doesn't import
   * the apps' bootstrap singleton.
   */
  storage?: StorageBinding;
  /**
   * Request-scoped analytics binding. Apps build it from the request
   * (resolves distinctId + base properties) so routers just call
   * `ctx.analytics?.capture("stamp.earned", { cardId })`. Optional
   * because tests + CLI scripts don't need it.
   * See `.claude/skills/analytics/SKILL.md`.
   */
  analytics?: AnalyticsBinding;
};

export const createContext = async (opts: { headers: Headers }): Promise<Context> => {
  const session = await auth.api.getSession({ headers: opts.headers });
  return {
    db,
    session,
    headers: opts.headers,
  };
};

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

export const router = t.router;
export const middleware = t.middleware;

const TOO_MANY = "Too many requests. Slow down and try again shortly.";

// Generous baseline so a single client can't hammer the API, applied to
// every procedure. Keyed per user (or IP when anonymous); query vs
// mutation get different ceilings. Abuse-sensitive procedures stack a
// tighter `rateLimit({...})` on top (separate named counter → it trips
// first). Fails open when no limiter is bound (CLI/tests).
const BASELINE_QUERY: RateLimitRule = { limit: 120, window: "1m" };
const BASELINE_MUTATION: RateLimitRule = { limit: 40, window: "1m" };

const withBaseline = t.middleware(async ({ ctx, next, type }) => {
  if (!ctx.rateLimiter || (type !== "query" && type !== "mutation")) {
    return next();
  }
  const userId = ctx.session?.user?.id;
  const key = userId ? `user:${userId}` : `ip:${getClientIp(ctx.headers)}`;
  const rule = type === "mutation" ? BASELINE_MUTATION : BASELINE_QUERY;
  const res = await ctx.rateLimiter.limit(`baseline:${type}:${key}`, rule);
  if (!res.success) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: TOO_MANY });
  }
  return next();
});

/**
 * Per-procedure rate limit, stacked via `.use()`. The counter is named
 * (so it never shares a bucket with the baseline) and keyed by `by`
 * (default `ipOrUser`; pass a fn for phone-keyed OTP-style limits).
 *
 * @example
 *   .use(rateLimit({ name: "sellos.add", limit: 20, window: "1m", by: "user" }))
 *   .use(rateLimit({ name: "otp", limit: 5, window: "30m",
 *                    by: (_, i) => `phone:${(i as { phoneNumber?: string }).phoneNumber}` }))
 */
export function rateLimit(opts: RateLimitOptions) {
  const by = opts.by ?? "ipOrUser";
  const name = opts.name ?? "default";
  return t.middleware(async ({ ctx, next, getRawInput }) => {
    if (!ctx.rateLimiter) return next();
    const rawInput = typeof by === "function" ? await getRawInput() : undefined;
    const key = await resolveKey(by, ctx, rawInput);
    if (key === null) return next();
    const res = await ctx.rateLimiter.limit(`${name}:${key}`, {
      limit: opts.limit,
      window: opts.window,
    });
    if (!res.success) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: TOO_MANY });
    }
    return next();
  });
}

/** Every exported procedure builds on this — baseline limit included. */
const baseProcedure = t.procedure.use(withBaseline);

export const publicProcedure = baseProcedure;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, session: ctx.session },
  });
});

export const protectedProcedure = baseProcedure.use(enforceAuth);

/**
 * Role-aware middleware factory. Builds on `enforceAuth` (so callers
 * always get a non-null `ctx.session`) and adds a `member.role` lookup
 * + check. Adds the resolved role to the context so downstream
 * resolvers can inspect it without re-querying.
 */
const enforceRole = (allowed: readonly Role[]) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    const role = await getUserRole(ctx.session.user.id);
    if (!allowed.includes(role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({
      ctx: { ...ctx, session: ctx.session, role },
    });
  });

/** Procedures gated by `member.role`. Replace `protectedProcedure` with one of these
 *  when a feature should be off-limits to plain customers. */
export const staffProcedure = baseProcedure.use(enforceRole(STAFF_OR_ABOVE));
export const managerProcedure = baseProcedure.use(enforceRole(MANAGER_OR_ABOVE));
export const ownerProcedure = baseProcedure.use(enforceRole(OWNER_ONLY));

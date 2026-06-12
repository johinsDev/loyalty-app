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
import type { FlagsBinding } from "@loyalty/feature-flags";
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

/** Fields attached to a structured log record. */
type LogFields = Record<string, unknown>;

/**
 * Structural slice of `@loyalty/log`'s `Logger` — just the levels the
 * timing middleware uses. Apps bind their configured logger so perf
 * records ship through whatever channel they default to (Better Stack in
 * preview/prod). Optional so CLI scripts + tests run untimed (fail open).
 * See `.claude/skills/trpc-perf/SKILL.md`.
 */
export interface LoggerBinding {
  info(fields: LogFields, msg?: string): void;
  warn(fields: LogFields, msg?: string): void;
  error(fields: LogFields, msg?: string): void;
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
  /**
   * Request-scoped feature flags binding. Apps build it from the request
   * (distinctId pre-resolved) so routers just call
   * `if (await ctx.flags?.isEnabled("new-stamp-flow")) { ... }`.
   * Optional because tests + CLI scripts don't need it.
   * See `.claude/skills/feature-flags/SKILL.md`.
   */
  flags?: FlagsBinding;
  /**
   * Request-scoped logger. Apps bind their configured `@loyalty/log`
   * logger so the timing middleware can emit per-procedure perf records
   * (and routers can `ctx.log?.info(...)` ad hoc). Optional — fails open
   * when absent. See `.claude/skills/trpc-perf/SKILL.md`.
   */
  log?: LoggerBinding;
  /**
   * Optional error-capture hook. Apps bind it to Sentry
   * (`captureException` + per-event user context); the package stays
   * SDK-agnostic, mirroring `realtime`/`analytics`/`flags`. The
   * `withErrorCapture` middleware calls it only for *unexpected* errors
   * (5xx-equivalent) — expected 4xx (auth, validation, rate-limit) are
   * skipped. Optional → tests + CLI run without it.
   * See `.claude/skills/sentry/SKILL.md`.
   */
  captureError?: CaptureError;
  /**
   * Short host base URL (e.g. `https://l.t4diverclub.app/r`) bound by the
   * app so the `shortlinks` router can return full short URLs. Optional —
   * unset on apps that don't serve shortlinks. See `.claude/skills/shortlinks/SKILL.md`.
   */
  shortlinkBaseUrl?: string;
  /**
   * Shortlinks creation binding — the `@loyalty/shortlinks` manager. The
   * admin `create` procedure calls `ctx.shortlinks.shorten(...)` so slug-gen
   * + dedupe live in the provider. Optional — only the Worker binds it.
   */
  shortlinks?: ShortlinksBinding;
};

/** Structural slice of the `@loyalty/shortlinks` manager (the `shorten` op). */
export interface ShortlinksBinding {
  shorten(
    url: string,
    opts: {
      organizationId: string;
      slug?: string;
      expiresAt?: Date;
      createdByUserId?: string;
    },
  ): Promise<{ shortUrl: string; slug: string | null }>;
}

/** Shape of the app-provided Sentry capture hook (see `captureError`). */
export type CaptureError = (
  error: unknown,
  context?: { userId?: string; path?: string; type?: string },
) => void;

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

// Procedures slower than this are logged at `warn` (everything else at
// `info`, failures at `error`) so a Better Stack alert can key off level.
const SLOW_MS = 500;

/**
 * Times every procedure and emits one structured perf record per call
 * through `ctx.log` (→ Better Stack in preview/prod). Outermost in the
 * chain so the duration covers the baseline limit, auth/role lookups and
 * the resolver, and so throttled (429) calls are still recorded. Fails
 * open when no logger is bound (CLI/tests). See the `trpc-perf` skill.
 */
const withTiming = t.middleware(async ({ ctx, next, path, type }) => {
  const start = performance.now();
  const res = await next();
  if (!ctx.log) return res;
  const durationMs = Math.round(performance.now() - start);
  const fields: Record<string, unknown> = {
    event: "trpc.request",
    path,
    type,
    durationMs,
    ok: res.ok,
    ...(res.ok ? {} : { code: res.error.code }),
    ...(ctx.session?.user?.id ? { userId: ctx.session.user.id } : {}),
  };
  const msg = `trpc ${type} ${path} ${durationMs}ms`;
  if (!res.ok) ctx.log.error(fields, msg);
  else if (durationMs >= SLOW_MS) ctx.log.warn(fields, msg);
  else ctx.log.info(fields, msg);
  return res;
});

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

// tRPC error codes that are part of normal operation — client mistakes,
// auth, validation, rate-limit. We don't want these in Sentry (they'd drown
// the real bugs). Everything else (chiefly INTERNAL_SERVER_ERROR from an
// uncaught throw) is captured.
const EXPECTED_ERROR_CODES: ReadonlySet<string> = new Set([
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "TOO_MANY_REQUESTS",
  "CONFLICT",
  "PRECONDITION_FAILED",
  "UNPROCESSABLE_CONTENT",
  "METHOD_NOT_SUPPORTED",
  "PARSE_ERROR",
]);

// Forwards *unexpected* errors to the app-bound Sentry hook. tRPC catches
// thrown errors and formats them (they never bubble to Next's
// `onRequestError`), so this is where server-side exceptions get captured.
// No-op when no `captureError` is bound (tests/CLI).
const withErrorCapture = t.middleware(async ({ ctx, next, path, type }) => {
  const result = await next();
  if (!result.ok && ctx.captureError && !EXPECTED_ERROR_CODES.has(result.error.code)) {
    ctx.captureError(result.error, {
      userId: ctx.session?.user?.id,
      path,
      type,
    });
  }
  return result;
});

/** Every exported procedure builds on this — perf timing (outermost) + error
 *  capture (→ Sentry) + baseline limit. */
const baseProcedure = t.procedure
  .use(withTiming)
  .use(withErrorCapture)
  .use(withBaseline);

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

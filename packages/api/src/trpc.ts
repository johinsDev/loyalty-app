import { auth, type Session } from "@loyalty/auth/server";
import { db } from "@loyalty/db";
import type { FakeRealtime, RealtimeClient } from "@loyalty/realtime";
import type { StorageDisk } from "@loyalty/storage";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

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

export type Context = {
  db: typeof db;
  session: Session | null;
  headers: Headers;
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
export const publicProcedure = t.procedure;

const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { ...ctx, session: ctx.session },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

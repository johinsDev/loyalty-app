import { auth, type Session } from "@loyalty/auth/server";
import { db } from "@loyalty/db";
import type { FakeRealtime, RealtimeClient } from "@loyalty/realtime";
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

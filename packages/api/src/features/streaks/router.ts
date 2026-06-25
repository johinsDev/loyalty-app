import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";

import {
  type CacheBinding,
  protectedProcedure,
  type RealtimeBinding,
  rateLimit,
  router,
  staffProcedure,
} from "../../trpc";
import { StreaksRepository } from "./repository";
import {
  cancelClaimInputSchema,
  claimInputSchema,
  confirmClaimWithCodeInputSchema,
  customerIdInputSchema,
  requestClaimInputSchema,
} from "./schemas";
import { StreaksService } from "./service";

/** The single principal org (single-tenant pilot). */
const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

/** Shared builder — the stamps router reuses this to advance the streak on a
 *  purchase. */
export function buildStreaksService(ctx: {
  db: typeof Db;
  realtime?: RealtimeBinding;
  cache?: CacheBinding;
}): StreaksService {
  return new StreaksService(new StreaksRepository(ctx.db), {
    realtime: ctx.realtime,
    cache: ctx.cache,
    signSecret: process.env.REALTIME_AUTH_SECRET ?? "",
  });
}

export const streaksRouter = router({
  // ---- Cashier (staff) ------------------------------------------------
  streakForCustomer: staffProcedure
    .input(customerIdInputSchema)
    .query(async ({ ctx, input }) =>
      buildStreaksService(ctx).streakForCustomer(await orgId(), input.customerId),
    ),

  claimReward: staffProcedure
    .use(
      rateLimit({ name: "streaks.claim", limit: 30, window: "1m", by: "user" }),
    )
    .input(claimInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildStreaksService(ctx).claimReward(
        await orgId(),
        ctx.session.user.id,
        input.token,
      ),
    ),

  // Code-based claim (the "no scanner" path) for the pending streak reward.
  // Keyed per (staff, customer) so a cashier can't spam codes at one customer.
  requestClaim: staffProcedure
    .use(
      rateLimit({
        name: "streaks.requestClaim",
        limit: 30,
        window: "1m",
        by: (ctx, input) => {
          const userId = ctx.session?.user?.id;
          const customerId = (input as { customerId?: string }).customerId;
          return userId ? `${userId}:${customerId ?? ""}` : null;
        },
      }),
    )
    .input(requestClaimInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildStreaksService(ctx).requestClaim(
        await orgId(),
        ctx.session.user.id,
        input.customerId,
      ),
    ),

  confirmClaimWithCode: staffProcedure
    .use(
      rateLimit({
        name: "streaks.confirmClaimWithCode",
        limit: 30,
        window: "1m",
        by: "user",
      }),
    )
    .input(confirmClaimWithCodeInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildStreaksService(ctx).confirmClaimWithCode(
        await orgId(),
        ctx.session.user.id,
        input.pendingId,
        input.code,
      ),
    ),

  // ---- Customer (self) ------------------------------------------------
  myStreak: protectedProcedure.query(async ({ ctx }) =>
    buildStreaksService(ctx).myStreak(await orgId(), ctx.session.user.id),
  ),

  myHistory: protectedProcedure.query(async ({ ctx }) =>
    buildStreaksService(ctx).myHistory(await orgId(), ctx.session.user.id),
  ),

  issueClaimToken: protectedProcedure.mutation(async ({ ctx }) =>
    buildStreaksService(ctx).issueClaimToken(await orgId(), ctx.session.user.id),
  ),

  // Customer revoke of a pending code-based streak claim — bound to the
  // authenticated customer.
  cancelClaim: protectedProcedure
    .input(cancelClaimInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildStreaksService(ctx).cancelClaim(ctx.session.user.id, input.pendingId),
    ),
});

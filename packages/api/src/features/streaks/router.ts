import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";

import {
  protectedProcedure,
  type RealtimeBinding,
  rateLimit,
  router,
  staffProcedure,
} from "../../trpc";
import { StreaksRepository } from "./repository";
import { claimInputSchema, customerIdInputSchema } from "./schemas";
import { StreaksService } from "./service";

/** The single principal org (single-tenant pilot). */
const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

/** Shared builder — the stamps router reuses this to advance the streak on a
 *  purchase. */
export function buildStreaksService(ctx: {
  db: typeof Db;
  realtime?: RealtimeBinding;
}): StreaksService {
  return new StreaksService(new StreaksRepository(ctx.db), {
    realtime: ctx.realtime,
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
});

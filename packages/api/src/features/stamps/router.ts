import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";

import {
  protectedProcedure,
  type RealtimeBinding,
  rateLimit,
  router,
  staffProcedure,
} from "../../trpc";
import { buildStreaksService } from "../streaks";
import { StampsRepository } from "./repository";
import {
  claimInputSchema,
  customerIdInputSchema,
  historyInputSchema,
  recordPurchaseInputSchema,
} from "./schemas";
import { StampsService } from "./service";

/** The single principal org (single-tenant pilot). */
const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

function buildService(ctx: {
  db: typeof Db;
  realtime?: RealtimeBinding;
}): StampsService {
  return new StampsService(new StampsRepository(ctx.db), {
    realtime: ctx.realtime,
    signSecret: process.env.REALTIME_AUTH_SECRET ?? "",
  });
}

export const stampsRouter = router({
  // ---- Cashier (staff) ------------------------------------------------
  recordPurchase: staffProcedure
    .use(
      rateLimit({
        name: "stamps.recordPurchase",
        limit: 60,
        window: "1m",
        by: "user",
      }),
    )
    .input(recordPurchaseInputSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await orgId();
      // Stamps blocks (throws REWARD_PENDING) before any streak side effect, so
      // a single purchase advances both tracks only when it actually records.
      const wallet = await buildService(ctx).recordPurchase(
        org,
        ctx.session.user.id,
        input,
      );
      // Best-effort, idempotent per day; never fails the purchase response.
      await buildStreaksService(ctx)
        .advanceForPurchase(org, input.customerId)
        .catch(() => {});
      return wallet;
    }),

  walletForCustomer: staffProcedure
    .input(customerIdInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).walletForCustomer(await orgId(), input.customerId),
    ),

  claim: staffProcedure
    .use(
      rateLimit({ name: "stamps.claim", limit: 30, window: "1m", by: "user" }),
    )
    .input(claimInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildService(ctx).claim(await orgId(), ctx.session.user.id, input.token),
    ),

  // ---- Customer (self) ------------------------------------------------
  myWallet: protectedProcedure.query(async ({ ctx }) =>
    buildService(ctx).myWallet(await orgId(), ctx.session.user.id),
  ),

  myHistory: protectedProcedure
    .input(historyInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).myHistory(await orgId(), ctx.session.user.id, input),
    ),

  myCompletedWallets: protectedProcedure.query(async ({ ctx }) =>
    buildService(ctx).myCompletedWallets(await orgId(), ctx.session.user.id),
  ),

  issueClaimToken: protectedProcedure.mutation(async ({ ctx }) =>
    buildService(ctx).issueClaimToken(await orgId(), ctx.session.user.id),
  ),
});

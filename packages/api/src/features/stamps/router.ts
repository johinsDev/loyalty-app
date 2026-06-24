import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";

import {
  protectedProcedure,
  type RealtimeBinding,
  rateLimit,
  router,
  staffProcedure,
} from "../../trpc";
import { tasks } from "@trigger.dev/sdk/v3";

import { buildPointsService } from "../points";
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
      // Stamps blocks (throws REWARD_PENDING) before any other side effect, so a
      // single purchase advances every track only when it actually records.
      const { wallet, purchaseId } = await buildService(ctx).recordPurchase(
        org,
        ctx.session.user.id,
        input,
      );
      // Points + streak: best-effort, idempotent; never fail the purchase.
      const points = await buildPointsService(ctx)
        .earnForPurchase(org, input.customerId, input.priceCents, purchaseId)
        .catch(() => ({ earned: 0, balance: 0 }));
      await buildStreaksService(ctx)
        .advanceForPurchase(org, input.customerId)
        .catch(() => {});

      // One consolidated per-purchase notification (WhatsApp + feed) combining
      // whatever's active — avoids a separate WhatsApp per loyalty track. Realtime
      // already animated each card inline. loyaltyMode-aware: only includes the
      // tracks that are on (stamps always on for the pilot).
      await tasks
        .trigger("send-notification", {
          customerIds: [input.customerId],
          organizationId: org,
          notificationKey: "purchase-recap",
          payload: {
            stamps: { currentStamps: wallet.currentStamps, completed: wallet.rewardPending },
            points: points.earned > 0 ? { earned: points.earned, balance: points.balance } : null,
          },
        })
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

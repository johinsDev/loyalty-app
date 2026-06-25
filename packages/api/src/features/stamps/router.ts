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
import { buildRewardsService, RewardsRepository } from "../rewards";
import { buildStreaksService } from "../streaks";
import { StampsRepository } from "./repository";
import {
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

      // Spendable balances BEFORE the purchase — used to detect rewards that
      // cross from not-claimable to claimable after this purchase's grants.
      const rewardsRepo = new RewardsRepository(ctx.db);
      const before = await rewardsRepo
        .balances(org, input.customerId)
        .catch(() => ({ stamps: 0, points: 0 }));

      // Stamps always records now (no completion / no block). Single purchase
      // advances every loyalty track.
      const { wallet, purchaseId } = await buildService(ctx).recordPurchase(
        org,
        ctx.session.user.id,
        input,
      );
      // Points + streak: best-effort, idempotent; never fail the purchase.
      const points = await buildPointsService(ctx)
        .earnForPurchase(org, input.customerId, input.priceCents, purchaseId)
        .catch(() => ({ earned: 0, balance: 0, tierUp: null }));
      await buildStreaksService(ctx)
        .advanceForPurchase(org, input.customerId)
        .catch(() => {});

      // One consolidated per-purchase recap (WhatsApp + feed) combining whatever
      // routine earn happened — avoids a separate WhatsApp per loyalty track.
      // Realtime already animated each card inline.
      await tasks
        .trigger("send-notification", {
          customerIds: [input.customerId],
          organizationId: org,
          notificationKey: "purchase-recap",
          payload: {
            stamps: { currentStamps: wallet.currentStamps },
            points:
              points.earned > 0
                ? { earned: points.earned, balance: points.balance }
                : null,
          },
        })
        .catch(() => {});

      // Rewards unlock detection + aggregated celebration (one combined
      // WhatsApp/push/realtime; N granular DB rows). Best-effort.
      const after = { stamps: wallet.currentStamps, points: points.balance };
      await buildRewardsService(ctx).processPurchaseUnlocks(
        org,
        input.customerId,
        before,
        after,
        { tierUp: points.tierUp ?? null },
      );

      return wallet;
    }),

  walletForCustomer: staffProcedure
    .input(customerIdInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).walletForCustomer(await orgId(), input.customerId),
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
});

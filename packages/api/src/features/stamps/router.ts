import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";

import {
  protectedProcedure,
  type RealtimeBinding,
  rateLimit,
  router,
  staffProcedure,
} from "../../trpc";
import { tasks } from "@trigger.dev/sdk/v3";

import { loadLocaleContext } from "../_shared/localize";
import { resolveActiveStoreId } from "../_shared/store-context";
import { buildPointsService } from "../points";
import { PromoRepository, PromoService, type UnitExclusion } from "../promotions";
import { enrichCart } from "../promotions/stitch";
import { evaluateRewardForCart } from "../rewards/pos-evaluate";
import { buildRewardsService, RewardsRepository } from "../rewards";
import { buildStreaksService } from "../streaks";
import { StampsRepository } from "./repository";
import {
  customerIdInputSchema,
  historyInputSchema,
  previewPurchaseInputSchema,
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
  // Read-only preview of an itemized sale: mirrors `recordPurchase`'s
  // reward-first-then-promo evaluation (same enriched cart + exclusions) so the
  // register shows the exact reward + promo discounts before recording. No
  // writes; a not-applicable reward returns a soft block instead of throwing.
  preview: staffProcedure
    .use(
      rateLimit({ name: "stamps.preview", limit: 120, window: "1m", by: "user" }),
    )
    .input(previewPurchaseInputSchema)
    .query(async ({ ctx, input }) => {
      const org = await orgId();
      const subtotalCents = input.items.reduce(
        (s, it) => s + it.unitAmountCents * it.qty,
        0,
      );
      const promoRepo = new PromoRepository(ctx.db);
      const enriched = await enrichCart(promoRepo, {
        currency: input.currency ?? "COP",
        lines: input.items,
      });

      // Reward first (its units are excluded from the promo remainder).
      let reward: {
        ok: boolean;
        discountCents: number;
        reason: string | null;
      } | null = null;
      let exclusions: UnitExclusion[] = [];
      if (input.inlineReward) {
        const rw = await new RewardsRepository(ctx.db).getReward(
          org,
          input.inlineReward.rewardId,
        );
        if (!rw || rw.status !== "published") {
          reward = { ok: false, discountCents: 0, reason: "reward-not-redeemable" };
        } else {
          const res = evaluateRewardForCart(rw, enriched);
          if (res.ok) {
            reward = { ok: true, discountCents: res.discountCents, reason: null };
            exclusions = res.exclusions;
          } else {
            reward = { ok: false, discountCents: 0, reason: res.reason };
          }
        }
      }

      const lc = await loadLocaleContext(ctx.db, org, ctx.headers);
      const { applicable, hints } = await new PromoService(
        ctx.db,
        promoRepo,
      ).applicable(
        org,
        input.customerId,
        { currency: input.currency ?? "COP", lines: input.items },
        lc,
        { exclusions, enriched },
      );

      return { subtotalCents, applicable, hints, reward };
    }),

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
      // The store this sale is attributed to (register store-switcher).
      const storeId = await resolveActiveStoreId(
        ctx.db,
        org,
        ctx.session.user.id,
        input.storeId,
      );

      // Itemized sale → resolve the net price server-side (never trust a
      // client-sent discount). Rewards first (the reward consumes its units),
      // promos on the remainder; points earn on net. Both discounts are
      // computed from the SAME enriched cart so they can't drift.
      let resolved: typeof input & {
        subtotalCents?: number;
        discountCents?: number;
        promoDiscountCents?: number;
        rewardDiscountCents?: number;
        grantStamp?: boolean;
      } = input;
      let netPrice = input.priceCents;
      let pointsMultiplier = 1;
      let grantStamp = true;
      if (input.items && input.items.length > 0) {
        const subtotal = input.items.reduce((s, it) => s + it.unitAmountCents * it.qty, 0);
        const promoRepo = new PromoRepository(ctx.db);
        const enriched = await enrichCart(promoRepo, {
          currency: input.currency ?? "COP",
          lines: input.items,
        });

        // Reward first: evaluate + exclude its units.
        let rewardDiscount = 0;
        let exclusions: UnitExclusion[] = [];
        if (input.inlineReward) {
          const rw = await new RewardsRepository(ctx.db).getReward(
            org,
            input.inlineReward.rewardId,
          );
          if (!rw || rw.status !== "published") {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "reward-not-redeemable" });
          }
          const evalResult = evaluateRewardForCart(rw, enriched);
          if (!evalResult.ok) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: "reward-item-not-in-cart",
            });
          }
          rewardDiscount = evalResult.discountCents;
          exclusions = evalResult.exclusions;
        }

        // Promo on the remainder (reward-consumed units excluded).
        let promoDiscount = 0;
        let appliedPromoId: string | undefined;
        if (input.appliedPromoId) {
          const lc = await loadLocaleContext(ctx.db, org, ctx.headers);
          const promoSvc = new PromoService(ctx.db, promoRepo);
          const { applicable } = await promoSvc.applicable(
            org,
            input.customerId,
            { currency: input.currency ?? "COP", lines: input.items },
            lc,
            { exclusions, enriched },
          );
          const chosen = applicable.find((a) => a.promo.id === input.appliedPromoId);
          if (!chosen) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PROMO_NOT_APPLICABLE" });
          }
          promoDiscount = chosen.discountCents;
          pointsMultiplier = chosen.pointsMultiplier;
          appliedPromoId = input.appliedPromoId;
        }

        const discountTotal = rewardDiscount + promoDiscount;
        netPrice = Math.max(0, subtotal - discountTotal);
        // A redemption-only ticket (net $0 with a reward) is a claim, not a
        // purchase — no stamp, no streak advance.
        grantStamp = !(netPrice === 0 && Boolean(input.inlineReward));
        resolved = {
          ...input,
          priceCents: netPrice,
          subtotalCents: subtotal,
          discountCents: discountTotal,
          promoDiscountCents: promoDiscount,
          rewardDiscountCents: rewardDiscount,
          appliedPromoId,
          grantStamp,
        };
      }

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
        storeId,
        resolved,
      );
      // Points + streak: best-effort, idempotent; never fail the purchase.
      const points = await buildPointsService(ctx)
        .earnForPurchase(org, input.customerId, netPrice, purchaseId, storeId, {
          multiplier: pointsMultiplier,
        })
        .catch(() => ({ earned: 0, balance: 0, tierUp: null }));
      if (grantStamp) {
        await buildStreaksService(ctx)
          .advanceForPurchase(org, input.customerId)
          .catch(() => {});
      }

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

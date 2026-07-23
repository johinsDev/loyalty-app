import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { pointsAccount } from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import {
  ownerProcedure,
  protectedProcedure,
  type RealtimeBinding,
  rateLimit,
  router,
  staffProcedure,
} from "../../trpc";
import { tasks } from "@trigger.dev/sdk/v3";

import {
  earnsPoints,
  earnsStamps,
  getLoyaltyConfig,
  loadLocaleContext,
  rateForCurrency,
} from "../_shared/localize";
import { resolveAttribution } from "../_shared/attribution";
import { resolveNet } from "../_shared/checkout-math";
import { resolveActiveStoreId } from "../_shared/store-context";
import { buildPointsService } from "../points";
import { tierDiscountPct } from "../points/tier-calc";
import { PromoRepository, PromoService, type UnitExclusion } from "../promotions";
import { enrichCart } from "../promotions/stitch";
import { evaluateRewardForCart } from "../rewards/pos-evaluate";
import { buildRewardsService, RewardsRepository } from "../rewards";
import { buildStreaksService } from "../streaks";
import { evaluateStampEligibility } from "./eligibility";
import { StampsRepository } from "./repository";
import {
  adjustStampsForCustomerInputSchema,
  customerIdInputSchema,
  historyInputSchema,
  previewPurchaseInputSchema,
  recordPurchaseInputSchema,
} from "./schemas";
import { StampsService } from "./service";

/** The single principal org (single-tenant pilot). */
const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

/** The accrual numbers a `WalletView` needs, from the cached loyalty config. */
const accOf = (loyalty: {
  stamps: { goal: number; purchasesPerStamp: number };
}) => ({
  goal: loyalty.stamps.goal,
  purchasesPerStamp: loyalty.stamps.purchasesPerStamp,
});

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
      const promoSvc = new PromoService(ctx.db, promoRepo);
      const cart = { currency: input.currency ?? "COP", lines: input.items };
      const [{ applicable, hints }, upsell] = await Promise.all([
        promoSvc.applicable(org, input.customerId, cart, lc, { exclusions, enriched }),
        // Actionable nudges for promos that don't yet apply (add-item, spend-to-
        // threshold, variant-swap) — same enriched cart + reward exclusions.
        promoSvc.upsell(org, input.customerId, cart, lc, { exclusions, enriched }),
      ]);

      // Combine layers with the org stacking policy so the shown total equals
      // the charged total. Preview the cashier-chosen promo, else the best.
      const chosen = input.appliedPromoId
        ? applicable.find((a) => a.promo.id === input.appliedPromoId)
        : applicable[0];
      const loyalty = await getLoyaltyConfig(ctx.db, org);
      const [tierRow] = await ctx.db
        .select({ key: pointsAccount.currentTierKey })
        .from(pointsAccount)
        .where(
          and(
            eq(pointsAccount.organizationId, org),
            eq(pointsAccount.customerId, input.customerId),
          ),
        )
        .limit(1);
      const tierPct = tierDiscountPct(tierRow?.key);
      const net = resolveNet(
        {
          subtotalCents,
          rewardDiscountCents: reward?.ok ? reward.discountCents : 0,
          promoDiscountCents: chosen?.discountCents ?? 0,
          promoExclusive: chosen?.exclusive ?? false,
          tierDiscountPct: tierPct,
        },
        loyalty.stacking,
      );

      return {
        subtotalCents,
        applicable,
        hints,
        upsell,
        reward,
        net: {
          ...net,
          tierDiscountPct: tierPct,
          appliedPromoId: net.suppressed.promo ? null : (chosen?.promo.id ?? null),
        },
      };
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

      // Org loyalty config (cached) + the customer's persisted tier discount %
      // (pre-purchase) — both feed the register stacking engine below and the
      // earn logic further down.
      const loyalty = await getLoyaltyConfig(ctx.db, org);
      const [tierRow] = await ctx.db
        .select({ key: pointsAccount.currentTierKey })
        .from(pointsAccount)
        .where(
          and(
            eq(pointsAccount.organizationId, org),
            eq(pointsAccount.customerId, input.customerId),
          ),
        )
        .limit(1);
      const tierPct = tierDiscountPct(tierRow?.key);

      // Itemized sale → resolve the net price server-side (never trust a
      // client-sent discount). Rewards first (the reward consumes its units),
      // promos on the remainder; points earn on net. Both discounts are
      // computed from the SAME enriched cart so they can't drift.
      let resolved: typeof input & {
        subtotalCents?: number;
        discountCents?: number;
        promoDiscountCents?: number;
        rewardDiscountCents?: number;
      } = input;
      let netPrice = input.priceCents;
      let pointsMultiplier = 1;
      let isRedemptionOnly = false;
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
        let promoExclusive = false;
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
          promoExclusive = chosen.exclusive;
        }

        // Combine the three layers per the org stacking policy: reward → promo →
        // tier %, exclusive-promo suppression, and the max-total-discount cap.
        // Server-authoritative — the previewed total equals the charged total.
        const net = resolveNet(
          {
            subtotalCents: subtotal,
            rewardDiscountCents: rewardDiscount,
            promoDiscountCents: promoDiscount,
            promoExclusive,
            tierDiscountPct: tierPct,
          },
          loyalty.stacking,
        );
        // A reward the customer chose to redeem can't be silently dropped by an
        // exclusive / no-stack promo — reject so the cashier resolves it (the
        // preview already surfaces the suppression).
        if (input.inlineReward && net.suppressed.reward) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "reward-not-combinable" });
        }
        // The promo is auto-applied — if the policy suppressed it, drop it (and
        // its points multiplier) silently.
        if (net.suppressed.promo) {
          appliedPromoId = undefined;
          pointsMultiplier = 1;
        }
        netPrice = net.netPriceCents;
        // A redemption-only ticket (net $0 with a reward) is a claim, not a
        // purchase — no stamp, no streak advance.
        isRedemptionOnly = netPrice === 0 && Boolean(input.inlineReward);
        resolved = {
          ...input,
          priceCents: netPrice,
          subtotalCents: subtotal,
          discountCents: net.totalDiscountCents,
          promoDiscountCents: net.promoDiscountCents,
          rewardDiscountCents: net.rewardDiscountCents,
          appliedPromoId,
        };
      }

      // Which tracks earn (loyalty loaded above). Redemption paths are never
      // gated — a paused track's balances stay spendable.
      const stampsOn = earnsStamps(loyalty.mode);
      const pointsOn = earnsPoints(loyalty.mode);

      // Stamp accrual rules (pure): track on → not a claim → min ticket →
      // category allowlist. Cart categories are fetched only when both an
      // allowlist and items exist; an item-less purchase always passes the
      // category rule (`null`). None of this gates points or streaks.
      let cartCategoryIds: string[] | null = null;
      const allowlist = loyalty.stamps.categoryIds;
      if (allowlist && allowlist.length > 0 && input.items && input.items.length > 0) {
        cartCategoryIds = await new StampsRepository(ctx.db).categoriesForProducts(
          input.items.map((it) => it.productId),
        );
      }
      const eligibility = evaluateStampEligibility({
        stampsOn,
        isRedemptionOnly,
        netPriceCents: netPrice,
        currency: input.currency ?? "COP",
        minAmount: loyalty.stamps.minAmount,
        eligibleCategoryIds: allowlist,
        cartCategoryIds,
      });
      const acc = accOf(loyalty);

      // Spendable balances BEFORE the purchase — used to detect rewards that
      // cross from not-claimable to claimable after this purchase's grants.
      const rewardsRepo = new RewardsRepository(ctx.db);
      const before = await rewardsRepo
        .balances(org, input.customerId)
        .catch(() => ({ stamps: 0, points: 0 }));

      // Marketing attribution: infer the entry source from the customer's recent
      // shortlink click / campaign send (best-effort; never fails the sale).
      const attribution = await resolveAttribution(ctx.db, {
        orgId: org,
        customerId: input.customerId,
      }).catch(() => null);

      // Stamps always records now (no completion / no block). Single purchase
      // advances every loyalty track.
      const { wallet, purchaseId } = await buildService(ctx).recordPurchase(
        org,
        ctx.session.user.id,
        storeId,
        {
          ...resolved,
          stampEligible: eligibility.eligible,
          acc,
          entrySource: attribution?.entrySource ?? null,
          metadata: attribution?.metadata ?? null,
        },
      );
      // Points + streak: best-effort, idempotent; never fail the purchase.
      const points = await buildPointsService(ctx)
        .earnForPurchase(org, input.customerId, netPrice, purchaseId, storeId, {
          multiplier: pointsMultiplier,
          loyalty: {
            enabled: pointsOn,
            rate: rateForCurrency(loyalty, input.currency ?? "COP"),
            tierGraceUntil: loyalty.tierGraceUntil,
          },
        })
        .catch(() => ({ earned: 0, balance: 0, tierUp: null }));
      // Streaks track visits, not stamps: any real purchase advances while the
      // stamps track is on — immune to min/category/per-N accrual rules.
      if (stampsOn && !isRedemptionOnly) {
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
    .query(async ({ ctx, input }) => {
      const org = await orgId();
      return buildService(ctx).walletForCustomer(
        org,
        input.customerId,
        accOf(await getLoyaltyConfig(ctx.db, org)),
      );
    }),

  // CRM: adjust a customer's stamps directly (no purchase). Owner-only.
  adjustForCustomer: ownerProcedure
    .input(adjustStampsForCustomerInputSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await orgId();
      return buildService(ctx).adjustForCustomer(
        org,
        input.customerId,
        input.stamps,
        input.reason,
        ctx.session.user.id,
        accOf(await getLoyaltyConfig(ctx.db, org)),
      );
    }),

  // ---- Customer (self) ------------------------------------------------
  // `paused` rides along so the card can show the redeem-only state (mode
  // gates EARNING only; collected stamps stay spendable).
  myWallet: protectedProcedure.query(async ({ ctx }) => {
    const org = await orgId();
    const loyalty = await getLoyaltyConfig(ctx.db, org);
    const wallet = await buildService(ctx).myWallet(
      org,
      ctx.session.user.id,
      accOf(loyalty),
    );
    return { ...wallet, paused: !earnsStamps(loyalty.mode) };
  }),

  myHistory: protectedProcedure
    .input(historyInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).myHistory(await orgId(), ctx.session.user.id, input),
    ),
});

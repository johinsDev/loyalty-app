import { type db as Db } from "@loyalty/db";
import { pointsAccount, type RewardBenefitConfig } from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { orgId, ownerProcedure, protectedProcedure, rateLimit, router, staffProcedure, type RealtimeBinding } from "../../trpc";
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
import { ORG_UTC_OFFSET_MINUTES } from "../promotions/engine";
import { buildPointsService, pointsForPrice } from "../points";
import { tierDiscountPct } from "../points/tier-calc";
import { PromoRepository, PromoService, type UnitExclusion } from "../promotions";
import { enrichCart } from "../promotions/stitch";
import { resolveRewardOnCart, type AppliedUpgradeInfo } from "../rewards/pos-upgrade";
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
  type SaleResultView,
} from "./schemas";
import { StampsService } from "./service";

/** What the register needs to draw the split line and explain it. */
interface RewardUpgradeView {
  /** Index into the CLIENT's items — pre-split, so the badge pins to the line
   *  the cashier is looking at. */
  sourceLineIndex: number;
  toVariantId: string;
  optionName: string;
  fromLabel: string;
  toLabel: string;
  deltaCents: number;
  remainingQty: number;
  upgradedUnitAmountCents: number;
}

/** Mirror the resolver's split onto the raw purchase lines, so the recorded
 *  ticket states what the customer receives: 2 Medianos and 1 Grande. */
function splitPurchaseLine<T extends { qty: number; unitAmountCents: number; variantId?: string | null }>(
  items: T[],
  upgrade: AppliedUpgradeInfo,
): (T & { rewardUpgradedFromVariantId?: string | null })[] {
  const source = items[upgrade.sourceLineIndex]!;
  const upgraded = {
    ...source,
    qty: 1,
    variantId: upgrade.toVariantId,
    unitAmountCents: upgrade.upgradedUnitAmountCents,
    // What the customer ordered, so the ticket can still name the drink the
    // reward was spent on once every line reads "Grande".
    rewardUpgradedFromVariantId: source.variantId ?? null,
  };
  if (source.qty === 1) {
    return items.map((it, i) => (i === upgrade.sourceLineIndex ? upgraded : it));
  }
  return [
    ...items.slice(0, upgrade.sourceLineIndex),
    { ...source, qty: source.qty - 1 },
    upgraded,
    ...items.slice(upgrade.sourceLineIndex + 1),
  ];
}

/** Labels come straight off the benefit config and the product name is already
 *  in the client's cart, so this costs no extra query. */
function toUpgradeView(
  upgrade: AppliedUpgradeInfo,
  benefit: RewardBenefitConfig | null,
): RewardUpgradeView | null {
  if (benefit?.type !== "variantUpgrade") return null;
  return {
    sourceLineIndex: upgrade.sourceLineIndex,
    toVariantId: upgrade.toVariantId,
    optionName: benefit.optionName,
    fromLabel: benefit.fromValueLabel,
    toLabel: benefit.toValueLabel,
    deltaCents: upgrade.deltaCents,
    remainingQty: upgrade.remainingQty,
    upgradedUnitAmountCents: upgrade.upgradedUnitAmountCents,
  };
}

/** The UTC instant of org-local midnight today — the "today" boundary for the
 *  register shift reads. */
function orgLocalMidnight(): Date {
  const offsetMs = ORG_UTC_OFFSET_MINUTES * 60_000;
  const local = new Date(Date.now() + offsetMs);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnight - offsetMs);
}

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
      const org = orgId(ctx);
      const promoRepo = new PromoRepository(ctx.db);
      const enriched = await enrichCart(promoRepo, {
        currency: input.currency ?? "COP",
        lines: input.items,
      }, org);

      // Every reward this request needs, in one round trip: the selected one
      // plus each row in the "ready to redeem" list. One `getReward` per id ran
      // on every debounced cart change.
      const rewardsRepo = new RewardsRepository(ctx.db);
      const neededRewardIds = [
        ...new Set([
          ...(input.rewardIds ?? []),
          ...(input.inlineReward ? [input.inlineReward.rewardId] : []),
        ]),
      ];
      const rewardsById = await rewardsRepo.getRewardsByIds(org, neededRewardIds);

      // Reward first (its units are excluded from the promo remainder).
      let reward: {
        ok: boolean;
        discountCents: number;
        reason: string | null;
        /** Cart line the reward discounts, so the register can name the drink
         *  instead of an unattributed "Recompensa − $17.000". Null for an
         *  order-wide voucher, which genuinely applies to the whole ticket. */
        lineIndex: number | null;
        /** What the benefit waived on that line (a free add-on's name), so the
         *  register can explain the amount instead of just placing it. */
        targetLabel: string | null;
      } | null = null;
      let exclusions: UnitExclusion[] = [];
      // A `variantUpgrade` reward CHANGES the cart, so everything downstream —
      // the subtotal, the promo remainder, the upsell — has to price the swapped
      // one. Default to the untouched cart for every other benefit.
      let pricedCart = enriched;
      let pricedItems = input.items;
      let rewardUpgrade: RewardUpgradeView | null = null;
      if (input.inlineReward) {
        const rw = rewardsById.get(input.inlineReward.rewardId);
        if (!rw || rw.status !== "published") {
          reward = {
            ok: false,
            discountCents: 0,
            reason: "reward-not-redeemable",
            lineIndex: null,
            targetLabel: null,
          };
        } else {
          const res = await resolveRewardOnCart(promoRepo, rw, enriched);
          reward = {
            ok: res.ok,
            discountCents: res.discountCents,
            reason: res.reason,
            // `target` covers the benefits that discount a line without
            // consuming a unit (a free add-on), which produce no exclusion.
            lineIndex: res.exclusions[0]?.lineIndex ?? res.target?.lineIndex ?? null,
            targetLabel: res.target?.label ?? null,
          };
          exclusions = res.exclusions;
          if (res.upgrade) {
            pricedCart = res.cart;
            pricedItems = splitPurchaseLine(input.items, res.upgrade);
            rewardUpgrade = toUpgradeView(res.upgrade, rw.benefit);
          }
        }
      }
      const subtotalCents = pricedItems.reduce(
        (s, it) => s + it.unitAmountCents * it.qty,
        0,
      );

      const lc = await loadLocaleContext(ctx.db, org, ctx.headers);
      const promoSvc = new PromoService(ctx.db, promoRepo);
      const cart = { currency: input.currency ?? "COP", lines: pricedItems };
      const [{ applicable, hints }, upsell] = await Promise.all([
        promoSvc.applicable(org, input.customerId, cart, lc, {
          exclusions,
          enriched: pricedCart,
        }),
        // Actionable nudges for promos that don't yet apply (add-item, spend-to-
        // threshold, variant-swap) — same cart, so the upsell can't offer to
        // upsize the very unit the reward just upsized.
        promoSvc.upsell(org, input.customerId, cart, lc, { exclusions, enriched: pricedCart }),
      ]);

      // Combine layers with the org stacking policy so the shown total equals
      // the charged total. Preview the cashier-chosen promo, else the best.
      // `skipPromo` is the cashier declining outright. Without it, omitting an
      // id meant "pick the best", so deselecting a promo had the server hand it
      // straight back on the next preview and the choice was unclickable.
      const chosen = input.skipPromo
        ? undefined
        : input.appliedPromoId
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

      // Per-reward line eligibility for the "ready to redeem" list: evaluate each
      // available reward against this cart so the register can gate selection.
      // The variant-graph read inside the resolver only fires for
      // `variantUpgrade` benefits, so the common path pays nothing.
      const rewardEligibility = await Promise.all(
        (input.rewardIds ?? []).map(async (rid) => {
          const r = rewardsById.get(rid);
          if (!r || r.status !== "published") {
            return { rewardId: rid, eligible: false, reason: "reward-not-redeemable" };
          }
          const res = await resolveRewardOnCart(promoRepo, r, enriched);
          return {
            rewardId: rid,
            eligible: res.ok,
            reason: res.reason,
            // Lets the register say WHICH size to add instead of a generic
            // "add the product", which is a lie when the product is right there.
            upgrade:
              r.benefit?.type === "variantUpgrade"
                ? {
                    optionName: r.benefit.optionName,
                    fromLabel: r.benefit.fromValueLabel,
                    toLabel: r.benefit.toValueLabel,
                  }
                : null,
          };
        }),
      );

      // Earn preview: what the sale will grant (points on the net + a stamp when
      // the ticket clears the minimum). A hint — recordPurchase is authoritative.
      const previewCurrency = input.currency ?? "COP";
      const pointsMult = chosen?.pointsMultiplier ?? 1;
      const earnPoints = earnsPoints(loyalty.mode)
        ? Math.round(pointsForPrice(net.netPriceCents, rateForCurrency(loyalty, previewCurrency)) * pointsMult)
        : 0;
      const minStamp = loyalty.stamps.minAmount?.[previewCurrency] ?? 0;
      const earnStamps =
        earnsStamps(loyalty.mode) && net.netPriceCents >= minStamp ? 1 : 0;

      return {
        subtotalCents,
        applicable,
        hints,
        upsell,
        reward,
        rewardEligibility,
        // Null when the stacking policy suppressed the reward — the swap didn't
        // happen, so the register must not draw it.
        rewardUpgrade: net.suppressed.reward ? null : rewardUpgrade,
        earn: { points: earnPoints, stamps: earnStamps },
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
      const org = orgId(ctx);
      // The store this sale is attributed to (register store-switcher).
      const storeId = await resolveActiveStoreId(
        ctx.db,
        org,
        ctx.session.user.id,
        input.storeId,
        ctx.role,
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
        const promoRepo = new PromoRepository(ctx.db);
        const enriched = await enrichCart(promoRepo, {
          currency: input.currency ?? "COP",
          lines: input.items,
        }, org);

        // Reward first: evaluate + exclude its units.
        let rewardDiscount = 0;
        let exclusions: UnitExclusion[] = [];
        // A `variantUpgrade` reward rewrites the ticket, so the persisted lines
        // and the subtotal must be the swapped ones.
        let pricedItems = input.items;
        if (input.inlineReward) {
          const rw = await new RewardsRepository(ctx.db).getReward(
            org,
            input.inlineReward.rewardId,
          );
          if (!rw || rw.status !== "published") {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "reward-not-redeemable" });
          }
          const evalResult = await resolveRewardOnCart(promoRepo, rw, enriched);
          if (!evalResult.ok) {
            // Surface the evaluator's own reason — it was hardcoded here, so a
            // reward that failed for any other cause still blamed the cart.
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message: evalResult.reason ?? "reward-item-not-in-cart",
            });
          }
          rewardDiscount = evalResult.discountCents;
          exclusions = evalResult.exclusions;
          if (evalResult.upgrade) pricedItems = splitPurchaseLine(input.items, evalResult.upgrade);
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
            { currency: input.currency ?? "COP", lines: pricedItems },
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
        const subtotal = pricedItems.reduce((acc, it) => acc + it.unitAmountCents * it.qty, 0);
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
          items: pricedItems,
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
          org,
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
      const { wallet, purchaseId, stampsEarned } = await buildService(ctx).recordPurchase(
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
        // Best-effort, but never silent: this swallowed a live `TypeError` for
        // who knows how long, reporting 0 points on sales that had already
        // credited them — and taking the tier recompute and the recap's points
        // line down with it.
        .catch((e: unknown) => {
          console.error("points.earnForPurchase failed", e);
          return { earned: 0, balance: 0, tierUp: null };
        });
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

      // The register's success summary states what THIS sale earned. Returning
      // only the wallet made it print the stamp balance even when the sale
      // earned no stamp — the one number that hadn't moved — while hiding the
      // points it did earn. Everything here was already computed above.
      return {
        wallet,
        purchaseId,
        totalCents: netPrice,
        earned: { stamps: stampsEarned, points: points.earned },
        pointsBalance: points.balance,
        tierUp: points.tierUp ?? null,
      } satisfies SaleResultView;
    }),

  walletForCustomer: staffProcedure
    .input(customerIdInputSchema)
    .query(async ({ ctx, input }) => {
      const org = orgId(ctx);
      return buildService(ctx).walletForCustomer(
        org,
        input.customerId,
        accOf(await getLoyaltyConfig(ctx.db, org)),
      );
    }),

  // Register header KPI: stamps + points granted at the active store today
  // (org-local). Powers the "sellos/puntos hoy" counter.
  shiftSummary: staffProcedure
    .input(z.object({ storeId: z.string().min(1) }))
    .query(async ({ ctx, input }) =>
      new StampsRepository(ctx.db).shiftSummary(input.storeId, orgLocalMidnight()),
    ),

  // The shift feed: today's non-void purchases at the active store (lean) so the
  // cashier can confirm what was rung up.
  shiftPurchases: staffProcedure
    .input(z.object({ storeId: z.string().min(1), limit: z.number().int().min(1).max(100).default(30) }))
    .query(async ({ ctx, input }) =>
      new StampsRepository(ctx.db).shiftPurchases(input.storeId, orgLocalMidnight(), input.limit),
    ),

  // CRM: adjust a customer's stamps directly (no purchase). Owner-only.
  adjustForCustomer: ownerProcedure
    .input(adjustStampsForCustomerInputSchema)
    .mutation(async ({ ctx, input }) => {
      const org = orgId(ctx);
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
    const org = orgId(ctx);
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
      buildService(ctx).myHistory(orgId(ctx), ctx.session.user.id, input),
    ),
});

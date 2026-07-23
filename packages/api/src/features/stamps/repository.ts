import type { db as Db } from "@loyalty/db";
import {
  loyaltyCard,
  type LoyaltyCardRow,
  pointsTransaction,
  productCategory,
  promoRedemption,
  purchase,
  purchaseItem,
  reward,
  stamp,
} from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";

import { redeemWithinTx } from "../rewards/redeem-tx";
import { applyStampProgress } from "./eligibility";
import type { PurchaseHistoryItem, StampsAccrual, WalletView } from "./schemas";

export type RecordResult =
  | { kind: "recorded"; wallet: WalletView; purchaseId: string }
  | { kind: "idempotent"; wallet: WalletView; purchaseId: string };

function toView(card: LoyaltyCardRow | null, acc: StampsAccrual): WalletView {
  return {
    id: card?.id ?? null,
    currentStamps: card?.currentStamps ?? 0,
    walletSize: acc.goal + 1,
    stampsGoal: acc.goal,
    pendingPurchases: card?.pendingPurchases ?? 0,
    purchasesPerStamp: acc.purchasesPerStamp,
    sequence: card?.sequence ?? 1,
  };
}

/**
 * Drizzle access for stamps: purchases, the single perpetual `active`
 * `loyalty_card` (whose `currentStamps` is the spendable balance), and the
 * stamp ledger. The free-drink reward is now a catalog reward claimed via the
 * rewards feature — the card never auto-completes and never blocks purchases.
 * Only layer that touches the db; recordPurchase runs in a transaction so the
 * purchase + stamp + balance bump are atomic.
 */
export class StampsRepository {
  constructor(private readonly db: typeof Db) {}

  /** The customer's single active card (null before any purchase). */
  async currentWallet(
    orgId: string,
    customerId: string,
  ): Promise<LoyaltyCardRow | null> {
    const rows = await this.db
      .select()
      .from(loyaltyCard)
      .where(
        and(
          eq(loyaltyCard.organizationId, orgId),
          eq(loyaltyCard.customerId, customerId),
          eq(loyaltyCard.status, "active"),
        ),
      )
      .orderBy(desc(loyaltyCard.sequence))
      .limit(1);
    return rows[0] ?? null;
  }

  async walletView(
    orgId: string,
    customerId: string,
    acc: StampsAccrual,
  ): Promise<WalletView> {
    return toView(await this.currentWallet(orgId, customerId), acc);
  }

  /** Distinct category ids of the given products (cart eligibility check). */
  async categoriesForProducts(productIds: string[]): Promise<string[]> {
    if (productIds.length === 0) return [];
    const rows = await this.db
      .selectDistinct({ categoryId: productCategory.categoryId })
      .from(productCategory)
      .where(inArray(productCategory.productId, productIds));
    return rows.map((r) => r.categoryId);
  }

  /** Register header KPI: stamps + points GRANTED at a store since `since`
   *  (org-local midnight → "today"). Positive movements only (redemptions/spends
   *  excluded) — it's a "what this register handed out today" counter. */
  async shiftSummary(
    storeId: string,
    since: Date,
  ): Promise<{ stampsToday: number; pointsToday: number }> {
    const [s] = await this.db
      .select({
        total: sql<number>`coalesce(sum(case when ${stamp.amount} > 0 then ${stamp.amount} else 0 end), 0)`,
      })
      .from(stamp)
      .where(and(eq(stamp.storeId, storeId), gte(stamp.createdAt, since)));
    const [p] = await this.db
      .select({
        total: sql<number>`coalesce(sum(case when ${pointsTransaction.points} > 0 then ${pointsTransaction.points} else 0 end), 0)`,
      })
      .from(pointsTransaction)
      .where(and(eq(pointsTransaction.storeId, storeId), gte(pointsTransaction.createdAt, since)));
    return { stampsToday: Number(s?.total ?? 0), pointsToday: Number(p?.total ?? 0) };
  }

  /** Manual admin stamp correction (CRM): a signed stamp row with no purchase +
   *  a clamped card-counter update, atomic. Opens an active card if none.
   *  Never touches `pendingPurchases` — corrections move stamps, not visits. */
  async adjustStamps(input: {
    orgId: string;
    customerId: string;
    delta: number;
    note: string;
    addedByUserId: string;
    acc: StampsAccrual;
  }): Promise<WalletView> {
    return this.db.transaction(async (tx) => {
      const active = await tx
        .select()
        .from(loyaltyCard)
        .where(
          and(
            eq(loyaltyCard.organizationId, input.orgId),
            eq(loyaltyCard.customerId, input.customerId),
            eq(loyaltyCard.status, "active"),
          ),
        )
        .orderBy(desc(loyaltyCard.sequence))
        .limit(1);
      let card = active[0];
      if (!card) {
        const created = await tx
          .insert(loyaltyCard)
          .values({
            customerId: input.customerId,
            organizationId: input.orgId,
            currentStamps: 0,
            status: "active",
            sequence: 1,
          })
          .returning();
        card = created[0]!;
      }
      const next = Math.max(0, card.currentStamps + input.delta);
      await tx.insert(stamp).values({
        cardId: card.id,
        purchaseId: null,
        addedByUserId: input.addedByUserId,
        amount: input.delta,
        note: input.note,
      });
      await tx
        .update(loyaltyCard)
        .set({ currentStamps: next, updatedAt: new Date() })
        .where(eq(loyaltyCard.id, card.id));
      return toView({ ...card, currentStamps: next }, input.acc);
    });
  }

  async recordPurchase(input: {
    orgId: string;
    customerId: string;
    addedByUserId: string;
    /** The store the sale happened at (register active store). */
    storeId: string;
    /** The NET charged (after any promo). */
    priceCents: number;
    idempotencyKey: string;
    // Optional itemized + promo breakdown.
    subtotalCents?: number;
    discountCents?: number;
    currency?: string;
    appliedPromoId?: string | null;
    // The reward's share of the ticket discount (v2 split): `discountCents` is
    // the TOTAL (promo + reward) on the purchase; `promoDiscountCents` is the
    // promo-only share on the promoRedemption; `rewardDiscountCents` is recorded
    // on the redemption. Fall back to `discountCents` when not split.
    promoDiscountCents?: number;
    rewardDiscountCents?: number;
    // Whether this purchase counts toward a stamp (org accrual rules already
    // evaluated by the router: track on, not redemption-only, min amount,
    // categories). An eligible purchase advances the per-N counter; the stamp
    // lands when the counter completes.
    stampEligible: boolean;
    /** Org accrual numbers (goal + purchases-per-stamp), from cached config. */
    acc: StampsAccrual;
    /** Marketing attribution resolved at record time (best-effort context). */
    entrySource?: string | null;
    metadata?: Record<string, unknown> | null;
    orderNote?: string | null;
    items?: {
      productId: string;
      variantId?: string | null;
      modifierOptionIds?: string[];
      qty: number;
      unitAmountCents: number;
      currency?: string;
      note?: string | null;
    }[];
    // Optional inline reward redeem within this sale (deducted after the stamp
    // is granted, so the just-earned stamp is spendable).
    inlineReward?: {
      rewardId: string;
      currency: "stamps" | "points" | "both";
      redeemedByUserId: string;
    };
  }): Promise<RecordResult> {
    return this.db.transaction(async (tx) => {
      // Idempotency: a retry with the same key returns the prior result.
      const existing = await tx
        .select()
        .from(purchase)
        .where(
          and(
            eq(purchase.organizationId, input.orgId),
            eq(purchase.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      if (existing[0]) {
        const card = await tx
          .select()
          .from(loyaltyCard)
          .where(eq(loyaltyCard.id, existing[0].walletId))
          .limit(1);
        return {
          kind: "idempotent",
          wallet: toView(card[0] ?? null, input.acc),
          purchaseId: existing[0].id,
        };
      }

      // Ensure the single active card (open the first one if needed). The card
      // is perpetual: it never completes, so there's only ever one per customer.
      const activeRows = await tx
        .select()
        .from(loyaltyCard)
        .where(
          and(
            eq(loyaltyCard.organizationId, input.orgId),
            eq(loyaltyCard.customerId, input.customerId),
            eq(loyaltyCard.status, "active"),
          ),
        )
        .orderBy(desc(loyaltyCard.sequence))
        .limit(1);
      let active = activeRows[0];
      if (!active) {
        const created = await tx
          .insert(loyaltyCard)
          .values({
            customerId: input.customerId,
            organizationId: input.orgId,
            currentStamps: 0,
            status: "active",
            sequence: 1,
          })
          .returning();
        active = created[0]!;
      }

      const currency = input.currency ?? "COP";
      const purch = await tx
        .insert(purchase)
        .values({
          customerId: input.customerId,
          organizationId: input.orgId,
          walletId: active.id,
          addedByUserId: input.addedByUserId,
          storeId: input.storeId,
          priceCents: input.priceCents,
          subtotalCents: input.subtotalCents ?? null,
          discountCents: input.discountCents ?? 0,
          currency,
          appliedPromoId: input.appliedPromoId ?? null,
          entrySource: input.entrySource ?? null,
          metadata: input.metadata ?? null,
          orderNote: input.orderNote ?? null,
          idempotencyKey: input.idempotencyKey,
        })
        .returning();
      const purchaseId = purch[0]!.id;

      // Itemized line items (snapshot) + promo redemption (usage), atomic.
      if (input.items && input.items.length > 0) {
        await tx.insert(purchaseItem).values(
          input.items.map((it) => ({
            purchaseId,
            productId: it.productId,
            variantId: it.variantId ?? null,
            modifierOptionIds: it.modifierOptionIds ?? null,
            qty: it.qty,
            unitAmountCents: it.unitAmountCents,
            currency: it.currency ?? currency,
            note: it.note ?? null,
          })),
        );
      }
      if (input.appliedPromoId) {
        await tx.insert(promoRedemption).values({
          promoId: input.appliedPromoId,
          customerId: input.customerId,
          purchaseId,
          discountCents: input.promoDiscountCents ?? input.discountCents ?? 0,
          currency,
        });
      }

      // Eligible purchase → advance the per-N counter; the stamp lands when it
      // completes. An ineligible purchase (paused / redemption-only / below-min
      // / category) moves neither the counter nor the balance.
      let wallet = toView(active, input.acc);
      if (input.stampEligible) {
        const progress = applyStampProgress(
          active.pendingPurchases,
          input.acc.purchasesPerStamp,
        );
        if (progress.grant) {
          await tx.insert(stamp).values({
            cardId: active.id,
            purchaseId,
            addedByUserId: input.addedByUserId,
            storeId: input.storeId,
            amount: 1,
          });
        }
        const updated = await tx
          .update(loyaltyCard)
          .set({
            ...(progress.grant
              ? { currentStamps: active.currentStamps + 1 }
              : {}),
            pendingPurchases: progress.nextPending,
            updatedAt: new Date(),
          })
          .where(eq(loyaltyCard.id, active.id))
          .returning();
        wallet = toView(updated[0] ?? null, input.acc);
      }

      // Inline reward redeem: AFTER the stamp + card bump (so the just-earned
      // stamp is spendable). A not-redeemable reward throws → the whole sale
      // (purchase included) rolls back, so the cashier can retry without it.
      if (input.inlineReward) {
        const rwRows = await tx
          .select()
          .from(reward)
          .where(
            and(
              eq(reward.organizationId, input.orgId),
              eq(reward.id, input.inlineReward.rewardId),
            ),
          )
          .limit(1);
        const rw = rwRows[0];
        if (!rw) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "reward-not-redeemable",
          });
        }
        const redeemed = await redeemWithinTx(tx, {
          orgId: input.orgId,
          customerId: input.customerId,
          reward: rw,
          currency: input.inlineReward.currency,
          claimedByUserId: input.inlineReward.redeemedByUserId,
          storeId: input.storeId,
          purchaseId,
          discountCents: input.rewardDiscountCents ?? 0,
        });
        if (redeemed.kind !== "claimed") {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "reward-not-redeemable",
          });
        }
        // Reflect the post-redeem spendable stamp balance in the returned wallet.
        wallet = { ...wallet, currentStamps: redeemed.stampsBalance };
      }

      return {
        kind: "recorded",
        wallet,
        purchaseId,
      };
    });
  }

  async history(
    orgId: string,
    customerId: string,
    page: number,
    pageSize: number,
  ): Promise<{ rows: PurchaseHistoryItem[]; total: number }> {
    const offset = (page - 1) * pageSize;
    // Real per-purchase stamp count (accrual rules mean not every purchase
    // earns one) so the FE maps filled spots only to stamping purchases.
    const rows = await this.db
      .select({
        id: purchase.id,
        priceCents: purchase.priceCents,
        createdAt: purchase.createdAt,
        walletSequence: loyaltyCard.sequence,
        stamps: sql<number>`coalesce(sum(${stamp.amount}), 0)`,
      })
      .from(purchase)
      .innerJoin(loyaltyCard, eq(purchase.walletId, loyaltyCard.id))
      .leftJoin(stamp, eq(stamp.purchaseId, purchase.id))
      .where(
        and(
          eq(purchase.organizationId, orgId),
          eq(purchase.customerId, customerId),
        ),
      )
      .groupBy(purchase.id)
      .orderBy(desc(purchase.createdAt))
      .limit(pageSize)
      .offset(offset);

    const count = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(purchase)
      .where(
        and(
          eq(purchase.organizationId, orgId),
          eq(purchase.customerId, customerId),
        ),
      );

    return {
      rows: rows.map((r) => ({
        id: r.id,
        priceCents: r.priceCents,
        stamps: r.stamps,
        walletSequence: r.walletSequence,
        createdAt: r.createdAt,
      })),
      total: count[0]?.value ?? 0,
    };
  }
}

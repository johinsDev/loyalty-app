import type { db as Db } from "@loyalty/db";
import {
  loyaltyCard,
  type LoyaltyCardRow,
  promoRedemption,
  purchase,
  purchaseItem,
  stamp,
  STAMPS_PER_REWARD,
  WALLET_SIZE,
} from "@loyalty/db/schema";
import { and, desc, eq, inArray, sql } from "drizzle-orm";

import type {
  CompletedWalletItem,
  PurchaseHistoryItem,
  WalletStatus,
  WalletView,
} from "./schemas";

export type RecordResult =
  | { kind: "recorded"; wallet: WalletView; purchaseId: string; completed: boolean }
  | { kind: "idempotent"; wallet: WalletView; purchaseId: string }
  | { kind: "reward_pending"; wallet: WalletView };

export type ClaimResult =
  | { kind: "claimed"; walletId: string; newWallet: WalletView }
  | { kind: "not_pending" };

function toView(card: LoyaltyCardRow | null): WalletView {
  if (!card) {
    return {
      id: null,
      currentStamps: 0,
      walletSize: WALLET_SIZE,
      stampsGoal: STAMPS_PER_REWARD,
      status: "active",
      sequence: 1,
      rewardPending: false,
    };
  }
  return {
    id: card.id,
    currentStamps: card.currentStamps,
    walletSize: WALLET_SIZE,
    stampsGoal: STAMPS_PER_REWARD,
    status: card.status as WalletStatus,
    sequence: card.sequence,
    rewardPending: card.status === "completed",
  };
}

/**
 * Drizzle access for stamps: purchases, the wallet (`loyalty_card`) lifecycle,
 * and the stamp ledger. Only layer that touches the db. The earn + claim flows
 * run in transactions so a purchase + stamp + wallet bump (and completion) are
 * atomic.
 */
export class StampsRepository {
  constructor(private readonly db: typeof Db) {}

  /** The card to show the customer: the active one, else the latest completed
   *  (reward-pending) one, else null. */
  async currentWallet(
    orgId: string,
    customerId: string,
  ): Promise<LoyaltyCardRow | null> {
    const active = await this.byStatus(orgId, customerId, "active");
    if (active) return active;
    return this.byStatus(orgId, customerId, "completed");
  }

  async walletView(orgId: string, customerId: string): Promise<WalletView> {
    return toView(await this.currentWallet(orgId, customerId));
  }

  /** The completed (reward-pending, unclaimed) card, if any. */
  pendingWallet(orgId: string, customerId: string): Promise<LoyaltyCardRow | null> {
    return this.byStatus(orgId, customerId, "completed");
  }

  private async byStatus(
    orgId: string,
    customerId: string,
    status: WalletStatus,
  ): Promise<LoyaltyCardRow | null> {
    const rows = await this.db
      .select()
      .from(loyaltyCard)
      .where(
        and(
          eq(loyaltyCard.organizationId, orgId),
          eq(loyaltyCard.customerId, customerId),
          eq(loyaltyCard.status, status),
        ),
      )
      .orderBy(desc(loyaltyCard.sequence))
      .limit(1);
    return rows[0] ?? null;
  }

  async recordPurchase(input: {
    orgId: string;
    customerId: string;
    addedByUserId: string;
    /** The NET charged (after any promo). */
    priceCents: number;
    idempotencyKey: string;
    // Optional itemized + promo breakdown.
    subtotalCents?: number;
    discountCents?: number;
    currency?: string;
    appliedPromoId?: string | null;
    items?: {
      productId: string;
      variantId?: string | null;
      modifierOptionIds?: string[];
      qty: number;
      unitAmountCents: number;
      currency?: string;
    }[];
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
          wallet: toView(card[0] ?? null),
          purchaseId: existing[0].id,
        };
      }

      // A completed-unclaimed card blocks new purchases — reward must be claimed.
      const pending = await tx
        .select()
        .from(loyaltyCard)
        .where(
          and(
            eq(loyaltyCard.organizationId, input.orgId),
            eq(loyaltyCard.customerId, input.customerId),
            eq(loyaltyCard.status, "completed"),
          ),
        )
        .orderBy(desc(loyaltyCard.sequence))
        .limit(1);
      if (pending[0]) {
        return { kind: "reward_pending", wallet: toView(pending[0]) };
      }

      // Ensure an active card (open the first/next one if needed).
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
        const maxRows = await tx
          .select({
            m: sql<number>`coalesce(max(${loyaltyCard.sequence}), 0)`,
          })
          .from(loyaltyCard)
          .where(
            and(
              eq(loyaltyCard.organizationId, input.orgId),
              eq(loyaltyCard.customerId, input.customerId),
            ),
          );
        const created = await tx
          .insert(loyaltyCard)
          .values({
            customerId: input.customerId,
            organizationId: input.orgId,
            currentStamps: 0,
            status: "active",
            sequence: (maxRows[0]?.m ?? 0) + 1,
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
          priceCents: input.priceCents,
          subtotalCents: input.subtotalCents ?? null,
          discountCents: input.discountCents ?? 0,
          currency,
          appliedPromoId: input.appliedPromoId ?? null,
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
          })),
        );
      }
      if (input.appliedPromoId && (input.discountCents ?? 0) >= 0) {
        await tx.insert(promoRedemption).values({
          promoId: input.appliedPromoId,
          customerId: input.customerId,
          purchaseId,
          discountCents: input.discountCents ?? 0,
          currency,
        });
      }

      await tx.insert(stamp).values({
        cardId: active.id,
        purchaseId,
        addedByUserId: input.addedByUserId,
        amount: 1,
      });

      const newStamps = active.currentStamps + 1;
      const completed = newStamps >= STAMPS_PER_REWARD;
      const updated = await tx
        .update(loyaltyCard)
        .set({
          currentStamps: newStamps,
          status: completed ? "completed" : "active",
          completedAt: completed ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(loyaltyCard.id, active.id))
        .returning();

      return {
        kind: "recorded",
        wallet: toView(updated[0] ?? null),
        purchaseId,
        completed,
      };
    });
  }

  async claimWallet(input: {
    orgId: string;
    walletId: string;
    customerId: string;
    claimedByUserId: string;
  }): Promise<ClaimResult> {
    return this.db.transaction(async (tx) => {
      // Single-use: the `status = completed` guard means a replay finds the card
      // already claimed → 0 rows → not_pending.
      const updated = await tx
        .update(loyaltyCard)
        .set({
          status: "claimed",
          claimedAt: new Date(),
          claimedByUserId: input.claimedByUserId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(loyaltyCard.id, input.walletId),
            eq(loyaltyCard.organizationId, input.orgId),
            eq(loyaltyCard.customerId, input.customerId),
            eq(loyaltyCard.status, "completed"),
          ),
        )
        .returning();
      if (!updated[0]) return { kind: "not_pending" };

      const created = await tx
        .insert(loyaltyCard)
        .values({
          customerId: input.customerId,
          organizationId: input.orgId,
          currentStamps: 0,
          status: "active",
          sequence: updated[0].sequence + 1,
        })
        .returning();

      return {
        kind: "claimed",
        walletId: input.walletId,
        newWallet: toView(created[0] ?? null),
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
    const rows = await this.db
      .select({
        id: purchase.id,
        priceCents: purchase.priceCents,
        createdAt: purchase.createdAt,
        walletSequence: loyaltyCard.sequence,
      })
      .from(purchase)
      .innerJoin(loyaltyCard, eq(purchase.walletId, loyaltyCard.id))
      .where(
        and(
          eq(purchase.organizationId, orgId),
          eq(purchase.customerId, customerId),
        ),
      )
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
        stamps: 1,
        walletSequence: r.walletSequence,
        createdAt: r.createdAt,
      })),
      total: count[0]?.value ?? 0,
    };
  }

  async completedWallets(
    orgId: string,
    customerId: string,
  ): Promise<CompletedWalletItem[]> {
    const rows = await this.db
      .select()
      .from(loyaltyCard)
      .where(
        and(
          eq(loyaltyCard.organizationId, orgId),
          eq(loyaltyCard.customerId, customerId),
          inArray(loyaltyCard.status, ["completed", "claimed"]),
        ),
      )
      .orderBy(desc(loyaltyCard.sequence));
    return rows.map((c) => ({
      id: c.id,
      sequence: c.sequence,
      status: c.status as "completed" | "claimed",
      completedAt: c.completedAt,
      claimedAt: c.claimedAt,
    }));
  }
}

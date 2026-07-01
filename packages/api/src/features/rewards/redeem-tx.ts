import type { db as Db } from "@loyalty/db";
import {
  loyaltyCard,
  pointsTransaction,
  redemption,
  type RewardRow,
  rewardAvailability,
} from "@loyalty/db/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";

import type { ClaimTxResult } from "./repository";

/** The Drizzle transaction handle, derived from the transaction callback param so
 *  it never drifts from the real type. */
export type DrizzleTx = Parameters<Parameters<typeof Db.transaction>[0]>[0];

export interface RedeemWithinTxInput {
  orgId: string;
  customerId: string;
  reward: RewardRow;
  currency: "stamps" | "points" | "both";
  claimedByUserId: string;
  /** The store the redemption happened at (register active store). */
  storeId: string;
  /** Set when redeeming inline as part of a register sale; null for QR/OTP. */
  purchaseId?: string;
}

/**
 * The core reward deduction, run against an existing Drizzle transaction handle:
 * re-checks the once-limit + balances inside the tx, deducts the chosen
 * currency/currencies, inserts the `redemption` row (with `purchaseId` for inline
 * register redemptions), deletes the availability row, and returns the new
 * balances. Shared by the rewards `claimTx` (standalone QR/OTP claim, purchaseId
 * undefined) and the stamps `recordPurchase` (inline POS redeem) so the two paths
 * can't drift in how they deduct/record.
 */
export async function redeemWithinTx(
  tx: DrizzleTx,
  input: RedeemWithinTxInput,
): Promise<ClaimTxResult> {
  const {
    orgId,
    customerId,
    reward: rw,
    currency,
    claimedByUserId,
    storeId,
    purchaseId,
  } = input;

  // "once": already claimed → reject (double-claim guard for once rewards).
  if (rw.limitPerCustomer === "once") {
    const prior = await tx
      .select({ id: redemption.id })
      .from(redemption)
      .where(
        and(
          eq(redemption.organizationId, orgId),
          eq(redemption.customerId, customerId),
          eq(redemption.rewardId, rw.id),
        ),
      )
      .limit(1);
    if (prior[0]) return { kind: "already_claimed" as const };
  }

  const payStamps = currency === "stamps" || currency === "both";
  const payPoints = currency === "points" || currency === "both";
  const stampsCost = payStamps ? (rw.stampsRequired ?? 0) : 0;
  const pointsCost = payPoints ? (rw.pointsCost ?? 0) : 0;

  // Deduct stamps: guard currentStamps >= cost via the WHERE clause so a
  // concurrent claim that already drained the balance finds 0 rows.
  let cardId: string | null = null;
  if (stampsCost > 0) {
    const cardRows = await tx
      .select({ id: loyaltyCard.id, currentStamps: loyaltyCard.currentStamps })
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
    const card = cardRows[0];
    if (!card || card.currentStamps < stampsCost) {
      return { kind: "insufficient" as const };
    }
    const updated = await tx
      .update(loyaltyCard)
      .set({
        currentStamps: card.currentStamps - stampsCost,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(loyaltyCard.id, card.id),
          gte(loyaltyCard.currentStamps, stampsCost),
        ),
      )
      .returning({ id: loyaltyCard.id });
    if (!updated[0]) return { kind: "insufficient" as const };
    cardId = card.id;
  }

  // Deduct points: re-sum inside the tx, then insert a signed redeem row.
  if (pointsCost > 0) {
    const balRows = await tx
      .select({
        total: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)`,
      })
      .from(pointsTransaction)
      .where(
        and(
          eq(pointsTransaction.organizationId, orgId),
          eq(pointsTransaction.customerId, customerId),
        ),
      );
    const bal = balRows[0]?.total ?? 0;
    if (bal < pointsCost) return { kind: "insufficient" as const };
    await tx.insert(pointsTransaction).values({
      customerId,
      organizationId: orgId,
      type: "redeem",
      points: -pointsCost,
      reason: `reward:${rw.id}`,
      addedByUserId: claimedByUserId,
      storeId,
    });
  }

  // The recorded currency: "both" rewards record as "stamps" (the card was
  // touched) with both *Spent columns set; single-currency records itself.
  const recordedCurrency: "stamps" | "points" =
    currency === "points" ? "points" : "stamps";
  const inserted = await tx
    .insert(redemption)
    .values({
      customerId,
      organizationId: orgId,
      cardId,
      rewardId: rw.id,
      redeemedByUserId: claimedByUserId,
      storeId,
      currency: recordedCurrency,
      stampsSpent: stampsCost,
      pointsSpent: pointsCost,
      purchaseId: purchaseId ?? null,
    })
    .returning({ id: redemption.id });

  // Re-arm: delete the availability row (a repeatable reward re-arms when the
  // balance climbs back over the cost on the next purchase).
  await tx
    .delete(rewardAvailability)
    .where(
      and(
        eq(rewardAvailability.customerId, customerId),
        eq(rewardAvailability.rewardId, rw.id),
      ),
    );

  const [stampsBalance, pointsBalance] = await Promise.all([
    tx
      .select({ s: loyaltyCard.currentStamps })
      .from(loyaltyCard)
      .where(
        and(
          eq(loyaltyCard.organizationId, orgId),
          eq(loyaltyCard.customerId, customerId),
          eq(loyaltyCard.status, "active"),
        ),
      )
      .orderBy(desc(loyaltyCard.sequence))
      .limit(1)
      .then((r) => r[0]?.s ?? 0),
    tx
      .select({
        total: sql<number>`coalesce(sum(${pointsTransaction.points}), 0)`,
      })
      .from(pointsTransaction)
      .where(
        and(
          eq(pointsTransaction.organizationId, orgId),
          eq(pointsTransaction.customerId, customerId),
        ),
      )
      .then((r) => r[0]?.total ?? 0),
  ]);

  return {
    kind: "claimed" as const,
    redemptionId: inserted[0]!.id,
    currency: recordedCurrency,
    stampsSpent: stampsCost,
    pointsSpent: pointsCost,
    stampsBalance,
    pointsBalance,
  };
}

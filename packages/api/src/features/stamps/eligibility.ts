/**
 * Pure stamp-accrual rules. `recordPurchase` evaluates these against the org's
 * stamps config; nothing here gates points earning or streaks.
 */

export type StampIneligibleReason =
  | "paused"
  | "redemption-only"
  | "below-min"
  | "category";

export type StampEligibility =
  | { eligible: true; reason: "ok" }
  | { eligible: false; reason: StampIneligibleReason };

export interface StampEligibilityInput {
  /** `earnsStamps(loyalty.mode)` — the stamps track is on. */
  stampsOn: boolean;
  /** Net-$0 ticket with an inline reward: a claim, not a purchase. */
  isRedemptionOnly: boolean;
  netPriceCents: number;
  currency: string;
  /** Org minimum net ticket per currency; missing/0 entry = no minimum. */
  minAmount: Record<string, number> | null;
  /** Org category allowlist; null/empty = every category is eligible. */
  eligibleCategoryIds: string[] | null;
  /**
   * Categories of the cart's products. `null` = item-less (amount-only)
   * purchase, which always passes the category rule — the register's quick
   * flow shouldn't cost the customer their stamp.
   */
  cartCategoryIds: string[] | null;
}

export function evaluateStampEligibility(
  input: StampEligibilityInput,
): StampEligibility {
  if (!input.stampsOn) return { eligible: false, reason: "paused" };
  if (input.isRedemptionOnly) return { eligible: false, reason: "redemption-only" };

  const min = input.minAmount?.[input.currency] ?? 0;
  if (input.netPriceCents < min) return { eligible: false, reason: "below-min" };

  const allowed = input.eligibleCategoryIds;
  if (allowed && allowed.length > 0 && input.cartCategoryIds !== null) {
    const hit = input.cartCategoryIds.some((id) => allowed.includes(id));
    if (!hit) return { eligible: false, reason: "category" };
  }

  return { eligible: true, reason: "ok" };
}

/**
 * Advance the 1-stamp-per-N-purchases counter by one eligible purchase.
 * `purchasesPerStamp: 1` degenerates to today's behavior (always grant,
 * counter pinned at 0). A lowered threshold applies immediately: a customer
 * with 2 pending under per=3 grants on their next purchase once per drops
 * to 2 — config changes never reset accumulated progress.
 */
export function applyStampProgress(
  pendingPurchases: number,
  purchasesPerStamp: number,
): { grant: boolean; nextPending: number } {
  const per = Math.max(1, purchasesPerStamp);
  const progressed = pendingPurchases + 1;
  return progressed >= per
    ? { grant: true, nextPending: 0 }
    : { grant: false, nextPending: progressed };
}

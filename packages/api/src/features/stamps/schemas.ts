import { z } from "zod";

// Customer ids mirror Better Auth `user.id` (not necessarily a UUID), so all
// customer-id inputs are validated as a non-empty string.
/** Owner CRM correction of a customer's stamps (signed, non-zero). */
export const adjustStampsForCustomerInputSchema = z.object({
  customerId: z.string().min(1),
  stamps: z
    .number()
    .int()
    .refine((v) => v !== 0, "Adjustment must be non-zero")
    .refine((v) => Math.abs(v) <= 100, "Adjustment out of range"),
  reason: z.string().trim().min(1).max(200),
});

/** A checkout line item (snapshot of the menu price at sale time). */
export const purchaseLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullish(),
  modifierOptionIds: z.array(z.string()).optional(),
  /** Catalog add-ons applied to this line (unit price already includes them). */
  addonIds: z.array(z.string()).optional(),
  /** Recipe ingredients removed ("sin X"), by ingredient id. */
  removedIngredientIds: z.array(z.string()).optional(),
  qty: z.number().int().min(1),
  unitAmountCents: z.number().int().nonnegative(),
  /** Free-form line note (e.g. "más hielo", "sin maní"). */
  note: z.string().max(200).nullish(),
});

export const recordPurchaseInputSchema = z.object({
  customerId: z.string().min(1),
  // The active store chosen at the register (store-switcher). The server
  // validates it against the org + cashier assignments and falls back to the
  // primary store when omitted/invalid.
  storeId: z.string().optional(),
  // For a non-itemized sale this is the charged total. For an itemized sale
  // (`items` present) the server computes the net from the items + promo and
  // ignores this value.
  priceCents: z.number().int().nonnegative(),
  // Client-generated; makes a double-tap / retry safe (unique per org).
  idempotencyKey: z.string().min(8).max(100),
  // Optional itemized checkout + chosen promo (discount re-computed server-side).
  items: z.array(purchaseLineSchema).optional(),
  appliedPromoId: z.string().uuid().optional(),
  currency: z.string().optional(),
  /** Cashier's order-level note (e.g. "para llevar", "mesa 4"). */
  orderNote: z.string().max(500).nullish(),
  // Optional inline reward redeem (POS): the cashier redeems a reward as part of
  // this same sale. Deducted inside the purchase tx (after the stamp is granted,
  // so it's spendable); a not-redeemable reward rolls back the whole sale.
  inlineReward: z
    .object({
      rewardId: z.string().min(1),
      currency: z.enum(["stamps", "points", "both"]),
    })
    .optional(),
});

export const customerIdInputSchema = z.object({
  customerId: z.string().min(1),
});

/** Read-only register preview: same reward-first-then-promo evaluation as
 *  `recordPurchase`, so the cashier sees the exact charge (reward + promo
 *  discounts) before committing the sale. */
export const previewPurchaseInputSchema = z.object({
  customerId: z.string().min(1),
  currency: z.string().optional(),
  items: z.array(purchaseLineSchema).min(1),
  inlineReward: z
    .object({
      rewardId: z.string().min(1),
      currency: z.enum(["stamps", "points", "both"]),
    })
    .optional(),
  /** The promo the cashier selected; omit to preview the best applicable one. */
  appliedPromoId: z.string().uuid().optional(),
  /** Available reward ids to check line eligibility for (the "ready to redeem"
   *  list) — the preview returns which apply to the current cart. */
  rewardIds: z.array(z.string()).optional(),
});

export const historyInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

/** The org accrual numbers the repository needs to shape a `WalletView` —
 *  resolved by the router from the cached `LoyaltyConfig` (`loyalty.stamps`). */
export interface StampsAccrual {
  goal: number;
  purchasesPerStamp: number;
}

/**
 * The customer's spendable stamp card, shaped for the FE. `id` is null before
 * any purchase exists. `currentStamps` is the spendable balance (it may exceed
 * `walletSize` — the card never auto-completes and never blocks purchases; the
 * card prize is a catalog reward claimed via the rewards flow). `stampsGoal`
 * comes from the org config (`walletSize = goal + 1`, the extra spot being the
 * prize); progress = `currentStamps % stampsGoal`. `pendingPurchases` /
 * `purchasesPerStamp` let the FE show "2/3 visits to your next stamp" when the
 * org grants a stamp every N purchases. */
export interface WalletView {
  id: string | null;
  currentStamps: number;
  walletSize: number;
  stampsGoal: number;
  pendingPurchases: number;
  purchasesPerStamp: number;
  sequence: number;
}

export interface PurchaseHistoryItem {
  id: string;
  priceCents: number;
  stamps: number;
  walletSequence: number;
  createdAt: Date;
}

export type RecordPurchaseInput = z.infer<typeof recordPurchaseInputSchema>;
export type HistoryInput = z.infer<typeof historyInputSchema>;

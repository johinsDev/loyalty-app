import { STAMPS_PER_REWARD, WALLET_SIZE } from "@loyalty/db/schema";
import { z } from "zod";

export { STAMPS_PER_REWARD, WALLET_SIZE };

// Customer ids mirror Better Auth `user.id` (not necessarily a UUID), so all
// customer-id inputs are validated as a non-empty string.
/** A checkout line item (snapshot of the menu price at sale time). */
export const purchaseLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullish(),
  modifierOptionIds: z.array(z.string()).optional(),
  qty: z.number().int().min(1),
  unitAmountCents: z.number().int().nonnegative(),
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
});

export const historyInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

/**
 * The customer's spendable stamp card, shaped for the FE. `id` is null before
 * any purchase exists. `currentStamps` is the spendable balance (it may exceed
 * `walletSize` — the card never auto-completes and never blocks purchases; the
 * free-drink reward is claimed via the rewards flow). `walletSize`/`stampsGoal`
 * are kept so the FE can still render the buy-9-get-1 card visual (progress =
 * `currentStamps % stampsGoal`). */
export interface WalletView {
  id: string | null;
  currentStamps: number;
  walletSize: number;
  stampsGoal: number;
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

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
});

export const customerIdInputSchema = z.object({
  customerId: z.string().min(1),
});

export const historyInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export const claimInputSchema = z.object({
  token: z.string().min(1),
});

export type WalletStatus = "active" | "completed" | "claimed";

/** The customer's current card, shaped for the FE. `id` is null before any
 *  purchase exists. `walletSize` = total spots on the card (incl. the free one);
 *  `stampsGoal` = paid stamps that complete it (the last spot is the free drink);
 *  `rewardPending` = a completed card is waiting to be claimed. */
export interface WalletView {
  id: string | null;
  currentStamps: number;
  walletSize: number;
  stampsGoal: number;
  status: WalletStatus;
  sequence: number;
  rewardPending: boolean;
}

export interface PurchaseHistoryItem {
  id: string;
  priceCents: number;
  stamps: number;
  walletSequence: number;
  createdAt: Date;
}

export interface CompletedWalletItem {
  id: string;
  sequence: number;
  status: "completed" | "claimed";
  completedAt: Date | null;
  claimedAt: Date | null;
}

export type RecordPurchaseInput = z.infer<typeof recordPurchaseInputSchema>;
export type HistoryInput = z.infer<typeof historyInputSchema>;

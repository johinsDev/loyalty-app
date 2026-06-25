import { STAMPS_PER_REWARD, WALLET_SIZE } from "@loyalty/db/schema";
import { z } from "zod";

export { STAMPS_PER_REWARD, WALLET_SIZE };

// Customer ids mirror Better Auth `user.id` (not necessarily a UUID), so all
// customer-id inputs are validated as a non-empty string.
export const recordPurchaseInputSchema = z.object({
  customerId: z.string().min(1),
  priceCents: z.number().int().nonnegative(),
  // Client-generated; makes a double-tap / retry safe (unique per org).
  idempotencyKey: z.string().min(8).max(100),
});

export const customerIdInputSchema = z.object({
  customerId: z.string().min(1),
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

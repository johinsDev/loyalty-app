import { WALLET_SIZE } from "@loyalty/db/schema";
import { z } from "zod";

export { WALLET_SIZE };

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

export const claimInputSchema = z.object({
  token: z.string().min(1),
});

export type WalletStatus = "active" | "completed" | "claimed";

/** The customer's current card, shaped for the FE. `id` is null before any
 *  purchase exists. `rewardPending` = a completed card is waiting to be claimed. */
export interface WalletView {
  id: string | null;
  currentStamps: number;
  walletSize: number;
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

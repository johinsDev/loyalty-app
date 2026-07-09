import { z } from "zod";

import type { TierConfig } from "./config";
import { WINDOW_DAYS } from "./config";

export { WINDOW_DAYS };

export const customerIdInputSchema = z.object({
  customerId: z.string().min(1),
});

/** Owner correction of a purchase's points (signed, non-zero) with a reason. */
export const adjustForPurchaseInputSchema = z.object({
  purchaseId: z.string().min(1),
  points: z
    .number()
    .int()
    .refine((v) => v !== 0, "Adjustment must be non-zero")
    .refine((v) => Math.abs(v) <= 100_000, "Adjustment out of range"),
  reason: z.string().trim().min(1).max(200),
});

export const historyInputSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

/** Cursor-paginated input for the dedicated transactions view (date-range +
 *  infinite scroll). `from`/`to` are ISO date strings; the cursor is the last
 *  seen row's `createdAt` ISO. */
export const transactionsInputSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

/** The customer's points + tier, shaped for the FE. `current`/`next` are the
 *  full tier configs (name, color, icon, benefits, terms) so the card + the
 *  level-up celebration render straight from this. */
export interface PointsSummary {
  balance: number;
  /** Points earned within the rolling window (drives the tier). */
  tierPoints: number;
  windowDays: number;
  current: TierConfig;
  next: TierConfig | null;
  /** 0..1 toward the next tier. */
  progress: number;
  remainingToNext: number;
  nearNext: boolean;
}

export interface PointsHistoryItem {
  id: string;
  type: "earn" | "redeem" | "adjust";
  points: number;
  reason: string | null;
  createdAt: Date;
}

export type PointsTransactionType = "earn" | "redeem" | "adjust";

/** Coarse, UI-labelable category derived from `(type, reason)` server-side. The
 *  raw `reward:<id>` reason is never exposed; reward rows carry `rewardName`. */
export type PointsTransactionKind = "purchase" | "reward" | "adjust" | "other";

/** A point-ledger row shaped for the UI to label without parsing strings. */
export interface PointsTransactionItem {
  id: string;
  type: PointsTransactionType;
  /** Signed: positive for earns, negative for redeems. */
  points: number;
  createdAt: Date;
  kind: PointsTransactionKind;
  /** The reward name for redeem rows (null when the reward was deleted). */
  rewardName: string | null;
  /** The purchase amount in cents for `purchase` rows — there's no product
   *  catalog yet, so the detail shows the value (null when not a purchase). */
  priceCents: number | null;
}

export interface PointsTransactionsView {
  items: PointsTransactionItem[];
  nextCursor: string | null;
}

export type HistoryInput = z.infer<typeof historyInputSchema>;
export type TransactionsInput = z.infer<typeof transactionsInputSchema>;

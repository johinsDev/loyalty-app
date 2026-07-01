import { z } from "zod";

import type { TierConfig } from "../points/config";

// ---- zod inputs ------------------------------------------------------------

export const rewardFilterSchema = z.enum([
  "all",
  "proximos",
  "listos",
  "canjeados",
]);

export const listInputSchema = z.object({
  search: z.string().trim().max(100).optional(),
  filter: rewardFilterSchema.default("all"),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const rewardIdInputSchema = z.object({
  rewardId: z.string().min(1),
});

export const issueClaimTokenInputSchema = z.object({
  rewardId: z.string().min(1),
  // Which balance to spend. "both" only valid for an "and"-cost reward.
  currency: z.enum(["stamps", "points", "both"]),
});

export const claimInputSchema = z.object({
  token: z.string().min(1),
  /** Active store chosen at the register (validated + resolved server-side). */
  storeId: z.string().optional(),
});

export const requestClaimInputSchema = z.object({
  customerId: z.string().min(1),
  rewardId: z.string().min(1),
  // The customer now picks the currency on their phone, so the cashier no longer
  // sends one. Left optional for back-compat; the service decides it server-side
  // (single-affordable / "and") or defers an OR-both reward to the customer.
  currency: z.enum(["stamps", "points", "both"]).optional(),
});

export const confirmClaimWithCodeInputSchema = z.object({
  pendingId: z.string().min(1),
  code: z.string().length(6),
  /** Active store chosen at the register (validated + resolved server-side). */
  storeId: z.string().optional(),
});

export const setClaimCurrencyInputSchema = z.object({
  pendingId: z.string().min(1),
  // The customer can only pick a single payable currency ("both" is an "and"
  // reward — decided server-side, never offered as a choice).
  currency: z.enum(["stamps", "points"]),
});

export const cancelClaimInputSchema = z.object({
  pendingId: z.string().min(1),
});

export const historyInputSchema = z.object({
  // ISO date strings; the service narrows to a window.
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const customerIdInputSchema = z.object({
  customerId: z.string().min(1),
});

// ---- shared value types ----------------------------------------------------

/** Customer-facing status of a reward in the catalog. */
export type RewardStatus = "ready" | "upcoming" | "locked" | "redeemed";

export type CostMode = "or" | "and";
export type RewardCurrency = "stamps" | "points";
export type LimitPerCustomer = "unlimited" | "once";

/** Progress for one currency toward this reward's cost. `required` is null when
 *  the currency isn't accepted; `affordable` once `balance >= required`. */
export interface CurrencyProgress {
  required: number | null;
  balance: number;
  /** 0..1 toward the cost (1 when not required / already affordable). */
  progress: number;
  affordable: boolean;
}

/** One reward as the customer sees it — catalog row + derived per-customer
 *  state (status, progress per currency, affordability). */
export interface RewardListItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  stampsRequired: number | null;
  pointsCost: number | null;
  costMode: CostMode;
  allowedTiers: string[] | null;
  sections: string[];
  sortOrder: number;
  limitPerCustomer: LimitPerCustomer;
  status: RewardStatus;
  /** Per-currency progress (null branch = that currency not accepted). */
  stamps: CurrencyProgress;
  points: CurrencyProgress;
  /** Currencies the customer can currently pay this reward with. For an "and"
   *  reward this is `["stamps","points"]` only when BOTH are affordable. */
  affordableWith: RewardCurrency[];
  /** When (once & already claimed) — the redemption time; else null. */
  redeemedAt: Date | null;
}

/** Detail view = the list item (no extra fields in v1, kept distinct for the
 *  UI contract so detail can diverge later). */
export type RewardDetail = RewardListItem;

/** A curated row on /recompensas (e.g. "destacados"). */
export interface RewardSection {
  key: string;
  items: RewardListItem[];
}

export interface RewardSectionsView {
  /** Section-keyed curated rows, in declared order. */
  sections: RewardSection[];
  /** Every item that matched the filter, flat (the "todos" grid). */
  all: RewardListItem[];
}

/** The list endpoint result. */
export interface RewardListView {
  items: RewardListItem[];
  nextCursor: string | null;
  sections: RewardSection[];
}

/** Tiers/levels view — reuses the points tier math. */
export interface LevelsView {
  current: TierConfig;
  next: TierConfig | null;
  /** 0..1 toward the next tier. */
  progress: number;
  remainingToNext: number;
  all: TierConfig[];
}

/** One past redemption, joined with its reward. */
export interface RedemptionHistoryItem {
  id: string;
  rewardId: string;
  rewardName: string;
  rewardImageUrl: string | null;
  currency: RewardCurrency;
  stampsSpent: number;
  pointsSpent: number;
  redeemedAt: Date;
  /** The purchase this reward was redeemed inline within (null for QR/OTP). */
  purchaseId: string | null;
}

export interface RedemptionHistoryView {
  items: RedemptionHistoryItem[];
  nextCursor: string | null;
}

/** A currently-ready reward, for the cashier nudge. */
export interface AvailableRewardItem {
  rewardId: string;
  name: string;
  stampsRequired: number | null;
  pointsCost: number | null;
  costMode: CostMode;
  /** Currencies the customer can pay this reward with right now. For an "or"
   *  reward this lists only the affordable option(s); for an "and" reward it's
   *  `["stamps","points"]` (paid as "both"). The reward only appears here when
   *  this is non-empty, so the cashier can present an affordable default. */
  affordableWith: RewardCurrency[];
}

/** Result of a `requestClaim` — the cashier hands the customer nothing; the
 *  code is delivered out-of-band (realtime + WhatsApp), never in this response. */
export interface RequestClaimResult {
  pendingId: string;
  expiresAt: string;
}

/** Result of a successful claim. */
export interface ClaimResultView {
  redemptionId: string;
  rewardId: string;
  rewardName: string;
  currency: RewardCurrency;
  stampsSpent: number;
  pointsSpent: number;
  /** New balances after the deduction. */
  stampsBalance: number;
  pointsBalance: number;
}

export type ListInput = z.infer<typeof listInputSchema>;
export type RewardFilter = z.infer<typeof rewardFilterSchema>;
export type IssueClaimTokenInput = z.infer<typeof issueClaimTokenInputSchema>;
export type HistoryInput = z.infer<typeof historyInputSchema>;
export type RequestClaimInput = z.infer<typeof requestClaimInputSchema>;
export type ConfirmClaimWithCodeInput = z.infer<
  typeof confirmClaimWithCodeInputSchema
>;
export type SetClaimCurrencyInput = z.infer<typeof setClaimCurrencyInputSchema>;
export type CancelClaimInput = z.infer<typeof cancelClaimInputSchema>;

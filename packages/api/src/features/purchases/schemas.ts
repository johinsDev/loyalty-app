import { z } from "zod";

import { listQueryBase } from "../_shared/list";

// ---- zod inputs ------------------------------------------------------------

/** Cursor-paginated + date-ranged list (mirrors points `transactionsInput`).
 *  `from`/`to` are ISO datetimes; the cursor is the last row's `createdAt` ISO. */
export const myPurchasesInputSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const purchaseIdInputSchema = z.object({
  id: z.string().min(1),
});

export const recentPurchasesInputSchema = z.object({
  limit: z.number().int().min(1).max(20).default(3),
});

export const usualsInputSchema = z.object({
  limit: z.number().int().min(1).max(20).default(4),
});

// ---- admin inputs ----------------------------------------------------------

/** "Effectiveness" facet: promo-driven / reward-driven / paid full price. */
export const purchaseEffectivenessSchema = z.enum(["promo", "reward", "full"]);
export const redemptionCurrencySchema = z.enum(["stamps", "points"]);
/** "Entry mode" (marketing attribution) facet. */
export const entrySourceSchema = z.enum(["campaign", "shortlink", "organic"]);

/** Offset-paginated, filtered, sorted list for the admin data-table. */
export const purchasesAdminListInputSchema = listQueryBase.extend({
  storeIds: z.array(z.string()).optional(),
  cashierIds: z.array(z.string()).optional(),
  /** Deep-link from a customer profile ("their purchases"). */
  customerId: z.string().optional(),
  effectiveness: z.array(purchaseEffectivenessSchema).optional(),
  redemptionCurrency: z.array(redemptionCurrencySchema).optional(),
  entrySource: z.array(entrySourceSchema).optional(),
  amountMin: z.number().int().min(0).optional(),
  amountMax: z.number().int().min(0).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type PurchasesAdminListInput = z.infer<typeof purchasesAdminListInputSchema>;

export const bulkIdsSchema = z.object({ ids: z.array(z.string()).min(1).max(500) });
export const purchaseAdminIdSchema = z.object({ id: z.string().min(1) });

/** Void (anulación) a purchase with a mandatory reason. */
export const voidPurchaseInputSchema = z.object({
  id: z.string().min(1),
  reason: z.string().trim().min(1).max(200),
});

// ---- output types ----------------------------------------------------------

/** One purchase as the customer sees it in a list (history / recent / home). */
export interface PurchaseListItem {
  id: string;
  createdAt: Date;
  /** The NET charged (after any promo) — `purchase.priceCents`. */
  totalCents: number;
  /** Pre-discount subtotal (null for non-itemized legacy purchases). */
  subtotalCents: number | null;
  discountCents: number;
  currency: string;
  /** A short human summary like "2× Latte +1" (null for amount-only sales). */
  itemSummary: string | null;
  /** Number of distinct line items (0 for amount-only). */
  itemCount: number;
  stampsEarned: number;
  pointsEarned: number;
  hasPromo: boolean;
  hasReward: boolean;
}

export interface PurchaseListView {
  items: PurchaseListItem[];
  nextCursor: string | null;
}

/** A resolved line item in the purchase detail. */
export interface PurchaseDetailItem {
  id: string;
  productId: string;
  /** Resolved product name (null when the product was deleted). */
  name: string | null;
  /** Resolved product slug (null when deleted) — for the product sub-detail link. */
  slug: string | null;
  /** The variant label (e.g. "Mediano"), composed from its option values. */
  variantLabel: string | null;
  /** The chosen modifier labels (e.g. ["Extra shot"]). */
  modifierLabels: string[];
  qty: number;
  unitAmountCents: number;
}

/** The promo applied to a purchase. */
export interface PurchaseDetailPromo {
  promoId: string;
  name: string | null;
  slug: string | null;
  discountCents: number;
  /** When the promo's benefit is a free item, a human label for it. */
  freeItemLabel: string | null;
}

/** The reward redeemed inline within a purchase. */
export interface PurchaseDetailReward {
  redemptionId: string;
  rewardId: string;
  name: string | null;
  imageUrl: string | null;
  currency: "stamps" | "points";
  stampsSpent: number;
  pointsSpent: number;
}

/** Full purchase composition for the detail screen. */
export interface PurchaseDetail {
  id: string;
  createdAt: Date;
  /** `user.name` of the staff who recorded it (null when unset/deleted). */
  cashierName: string | null;
  /** No store entity linked to a purchase yet → null in v1. */
  storeName: string | null;
  items: PurchaseDetailItem[];
  promo: PurchaseDetailPromo | null;
  reward: PurchaseDetailReward | null;
  subtotalCents: number | null;
  discountCents: number;
  totalCents: number;
  currency: string;
  stampsEarned: number;
  pointsEarned: number;
}

/** A "usual" — a product the customer orders often. */
export interface UsualItem {
  productId: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  /** How many times this product appears across the customer's purchases. */
  orders: number;
}

// ---- admin output types ----------------------------------------------------

/** One purchase as the admin sees it in the "command center" list. */
export interface PurchaseAdminListItem {
  id: string;
  createdAt: Date;
  customerId: string;
  customerName: string | null;
  customerPhone: string;
  /** Resolved from `purchase.storeId` (null for legacy/pilot rows). */
  storeName: string | null;
  cashierName: string | null;
  itemSummary: string | null;
  itemCount: number;
  /** NET charged (after promo/reward) — `purchase.priceCents`. */
  totalCents: number;
  discountCents: number;
  currency: string;
  stampsEarned: number;
  pointsEarned: number;
  hasPromo: boolean;
  hasReward: boolean;
  /** Set when the sale was voided (shown struck; excluded from KPIs). */
  voidedAt: Date | null;
}

/** Aggregate tiles above the list, honoring the active filters. */
export interface PurchasesKpis {
  count: number;
  netRevenueCents: number;
  avgTicketCents: number;
  /** Share of purchases with a promo applied, 0..1. */
  promoRate: number;
}

/** One derived event in a purchase's timeline (no dedicated persistence). */
export type PurchaseTimelineKind = "sale" | "stamp" | "points" | "redeem" | "adjust";
export interface PurchaseTimelineEvent {
  kind: PurchaseTimelineKind;
  at: Date;
  actorName: string | null;
  /** Stamps/points count (signed for `adjust`) for stamp/points/adjust events. */
  amount: number | null;
  /** Reward name for redeem events. */
  rewardName: string | null;
  /** Free-text reason for `adjust` events (the correction's justification). */
  reason: string | null;
}

/** Customer preview block on the admin detail. */
export interface PurchaseAdminCustomer {
  id: string;
  name: string | null;
  phone: string;
  /** `pointsAccount.currentTierKey` (null = base tier). */
  tierKey: string | null;
  memberSince: Date;
}

/** The admin "radiografía": the customer detail plus who/where/attribution. */
export interface PurchaseAdminDetail extends PurchaseDetail {
  customer: PurchaseAdminCustomer;
  storeId: string | null;
  /** Marketing attribution: "campaign" | "shortlink" | "organic" (null legacy). */
  entrySource: string | null;
  /** The attributed campaign id (from metadata), when entrySource is a campaign. */
  attributionCampaignId: string | null;
  idempotencyKey: string;
  timeline: PurchaseTimelineEvent[];
  /** Void (anulación) audit — null when the sale is active. */
  voidedAt: Date | null;
  voidReason: string | null;
  voidedByName: string | null;
}

export type MyPurchasesInput = z.infer<typeof myPurchasesInputSchema>;
export type RecentPurchasesInput = z.infer<typeof recentPurchasesInputSchema>;
export type UsualsInput = z.infer<typeof usualsInputSchema>;

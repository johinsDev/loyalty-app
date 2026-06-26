import { z } from "zod";

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

export type MyPurchasesInput = z.infer<typeof myPurchasesInputSchema>;
export type RecentPurchasesInput = z.infer<typeof recentPurchasesInputSchema>;
export type UsualsInput = z.infer<typeof usualsInputSchema>;

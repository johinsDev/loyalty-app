import { z } from "zod";

export const listInputSchema = z.object({
  cursor: z.string().nullish(),
  pageSize: z.number().int().min(1).max(40).default(12),
  categorySlug: z.string().nullish(),
  sectionSlug: z.string().nullish(),
  search: z.string().nullish(),
  // Active customer store: keep only products available at it (null/empty
  // storeIds = every store). Omitted → no store filter.
  storeId: z.string().optional(),
});

export const slugInputSchema = z.object({ slug: z.string().min(1) });

export const placementInputSchema = z.object({
  placement: z.enum(["menu", "home", "both"]).default("menu"),
  storeId: z.string().optional(),
});

export const productIdInputSchema = z.object({ productId: z.string().min(1) });

/** Earn preview for a price (display-only). */
export interface EarnPreview {
  points: number;
  stamp: boolean;
}

/** Compact product for cards/carousels/grid. */
export interface MenuCard {
  id: string;
  slug: string;
  name: string;
  /** Plain-text snippet (stripped from the rich description) for the featured card. */
  description: string | null;
  priceCents: number;
  /** Cheapest variant price when the product has variants — the real sellable
   *  price the card should show (`basePriceCents` is a phantom for these). */
  variantFromCents: number | null;
  /** True when variants span more than one price, so the card prefixes "desde". */
  priceFrom: boolean;
  /** Promotional price (< priceCents) when set; the card strikes through the
   *  regular price and charges this. */
  promoPriceCents: number | null;
  currency: string;
  imageUrl: string | null;
  categorySlugs: string[];
  earn: EarnPreview;
}

export interface MenuList {
  items: MenuCard[];
  nextCursor: string | null;
}

export interface SectionView {
  id: string;
  slug: string;
  name: string;
  kind: "carousel" | "banner" | "featured";
  /** True when the section has more products than the carousel shows (→ "Ver todo"). */
  hasMore: boolean;
  banner: {
    title: string | null;
    subtitle: string | null;
    imageUrl: string | null;
    href: string | null;
  } | null;
  products: MenuCard[];
}

export interface DetailImage {
  url: string;
  alt: string | null;
  variantId: string | null;
}

export interface DetailOption {
  id: string;
  name: string;
  values: { id: string; label: string }[];
}

export interface DetailVariant {
  id: string;
  priceCents: number;
  /** Per-variant promo price (< priceCents) when set — the effective charge. */
  promoPriceCents: number | null;
  isDefault: boolean;
  optionValueIds: string[];
  earn: EarnPreview;
  imageUrls: string[];
}

export interface DetailModifierGroup {
  id: string;
  name: string;
  selectionType: "single" | "multi";
  minSelect: number;
  maxSelect: number | null;
  required: boolean;
  options: { id: string; name: string; priceDeltaCents: number }[];
}

/** An add-on group on a product — items resolve the reusable add-on catalog. */
export interface DetailAddonGroup {
  id: string;
  name: string;
  selectionType: "single" | "multi";
  minSelect: number;
  maxSelect: number | null;
  required: boolean;
  items: { addonId: string; name: string; priceDeltaCents: number }[];
}

/** Full product for the detail (modal + SEO page). */
export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  currency: string;
  basePriceCents: number;
  promoPriceCents: number | null;
  earn: EarnPreview;
  images: DetailImage[];
  options: DetailOption[];
  variants: DetailVariant[];
  modifierGroups: DetailModifierGroup[];
  addonGroups: DetailAddonGroup[];
  /** Customer-visible ingredients ("Contiene …") — union across variants. */
  ingredients: string[];
  /** Customer-visible ingredients marked removable — the register "sin X" toggles. */
  removableIngredients: { ingredientId: string; name: string }[];
  categorySlugs: string[];
  seo: { title: string | null; description: string | null; ogImageUrl: string | null };
}

export type ListInput = z.infer<typeof listInputSchema>;

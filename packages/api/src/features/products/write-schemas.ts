import { z } from "zod";

// ---- Admin product write (upsert) ------------------------------------------
// The editor generates a client-side UUID for every new row, so `id` is always
// present (an existing DB id or a fresh uuid). The repository diffs by id:
// update existing, insert unknown, delete missing — which PRESERVES the
// variant/modifierOption ids that promo + reward JSON rules reference (no FK).

export const productStatusSchema = z.enum(["active", "draft", "archived"]);
export const stockModeSchema = z.enum(["infinite", "limited"]);
export const productTypeSchema = z.enum(["physical", "digital"]);
export const productGenderSchema = z.enum(["unisex", "female", "male"]);
export const productAgeRangeSchema = z.enum(["all", "kids", "teens", "adults"]);

const optionValueInput = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80),
  sortOrder: z.number().int().default(0),
});

const optionInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  sortOrder: z.number().int().default(0),
  values: z.array(optionValueInput).min(1),
});

const variantIngredientInput = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().min(0),
  visibleToCustomer: z.boolean().default(false),
  // A visible-to-customer ingredient marked removable shows as a "sin X" toggle.
  removable: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

const variantInput = z.object({
  id: z.string().min(1),
  sku: z.string().max(80).nullish(),
  priceCents: z.number().int().min(0),
  promoPriceCents: z.number().int().min(0).nullish(),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  // The option-value combo this variant represents (client-side value ids that
  // this same payload also creates/keeps).
  optionValueIds: z.array(z.string().min(1)),
  // The variant's recipe (replaced wholesale on save).
  ingredients: z.array(variantIngredientInput).default([]),
});

// ---- Ingredient catalog (org-level) ----------------------------------------
export const ingredientCreateSchema = z.object({
  name: z.string().min(1).max(80),
  unit: z.string().min(1).max(12).default("u"),
  costPerUnitCents: z.number().int().min(0).default(0),
});
export const ingredientUpdateSchema = ingredientCreateSchema.extend({
  id: z.string().min(1),
});
export const ingredientListInputSchema = z.object({
  search: z.string().trim().max(80).optional(),
});
export type IngredientCreateInput = z.infer<typeof ingredientCreateSchema>;
export type IngredientUpdateInput = z.infer<typeof ingredientUpdateSchema>;

export interface IngredientRow {
  id: string;
  name: string;
  unit: string;
  costPerUnitCents: number;
}

// ---- Add-on catalog (org-level) --------------------------------------------
export const addonCreateSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullish(),
  priceDeltaCents: z.number().int().min(0).default(0),
  costCents: z.number().int().min(0).default(0),
  // Optional link to a stocked ingredient (inherits cost/stock/recipe).
  ingredientId: z.string().min(1).nullish(),
  sku: z.string().max(80).nullish(),
  active: z.boolean().default(true),
});
export const addonUpdateSchema = addonCreateSchema.extend({
  id: z.string().min(1),
});
export const addonListInputSchema = z.object({
  search: z.string().trim().max(80).optional(),
});
export type AddonCreateInput = z.infer<typeof addonCreateSchema>;
export type AddonUpdateInput = z.infer<typeof addonUpdateSchema>;

export interface AddonRow {
  id: string;
  name: string;
  description: string | null;
  priceDeltaCents: number;
  costCents: number;
  ingredientId: string | null;
  ingredientName: string | null;
  sku: string | null;
  active: boolean;
}

const modifierOptionInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(80),
  priceDeltaCents: z.number().int().default(0),
  pointsDelta: z.number().int().nullish(),
  sortOrder: z.number().int().default(0),
});

const modifierGroupInput = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  selectionType: z.enum(["single", "multi"]).default("multi"),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).nullish(),
  required: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  options: z.array(modifierOptionInput).default([]),
});

// An add-on group attaches catalog add-ons to a product; `items` reference the
// reusable add-on catalog (price comes from the catalog, not per-product).
const addonGroupItemInput = z.object({
  id: z.string().min(1),
  addonId: z.string().min(1),
  sortOrder: z.number().int().default(0),
});
const addonGroupInput = z.object({
  id: z.string().min(1),
  // Optional — an unnamed group falls back to a default header at the register.
  name: z.string().max(60).default(""),
  selectionType: z.enum(["single", "multi"]).default("multi"),
  minSelect: z.number().int().min(0).default(0),
  maxSelect: z.number().int().min(1).nullish(),
  required: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  items: z.array(addonGroupItemInput).default([]),
});

const imageInput = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  alt: z.string().max(160).nullish(),
  // When set, the image swaps in for that variant's selection.
  variantId: z.string().min(1).nullish(),
  sortOrder: z.number().int().default(0),
});

export const productUpsertInputSchema = z.object({
  id: z.string().min(1), // the draft/existing product id (from createDraft)
  name: z.string().min(1).max(120),
  description: z.string().nullish(), // tiptap HTML
  status: productStatusSchema,
  basePriceCents: z.number().int().min(0),
  promoPriceCents: z.number().int().min(0).nullish(),
  currency: z.string().min(1).max(3).default("COP"),
  brand: z.string().max(80).nullish(),
  gender: productGenderSchema.nullish(),
  ageRange: productAgeRangeSchema.nullish(),
  mpn: z.string().max(80).nullish(),
  stockMode: stockModeSchema.default("infinite"),
  stockQty: z.number().int().min(0).nullish(),
  productType: productTypeSchema.default("physical"),
  sortOrder: z.number().int().default(0),
  recipeNotes: z.string().nullish(),
  seoTitle: z.string().max(160).nullish(),
  seoDescription: z.string().max(320).nullish(),
  ogImageUrl: z.string().url().nullish().or(z.literal("")),
  categoryIds: z.array(z.string().min(1)).default([]),
  // Stores this product is available at (null/empty = every store). Only
  // persisted when present in the input.
  storeIds: z.array(z.string()).nullable().optional(),
  options: z.array(optionInput).default([]),
  variants: z.array(variantInput).default([]),
  modifierGroups: z.array(modifierGroupInput).default([]),
  addonGroups: z.array(addonGroupInput).default([]),
  images: z.array(imageInput).default([]),
});

export type ProductUpsertInput = z.infer<typeof productUpsertInputSchema>;

export const productAdminListInputSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.array(productStatusSchema).optional(),
  categoryId: z.array(z.string()).optional(),
  // Active store scope — restrict to products available at this store.
  storeId: z.string().optional(),
  sort: z.enum(["name", "price", "updated"]).default("updated"),
  dir: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(20),
});
export type ProductAdminListInput = z.infer<typeof productAdminListInputSchema>;

/** One product row in the admin data-table. */
export interface ProductAdminRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  basePriceCents: number;
  currency: string;
  imageUrl: string | null;
  variantCount: number;
  categoryNames: string[];
  storeIds: string[] | null;
  updatedAt: Date;
}

export interface ProductAdminList {
  rows: ProductAdminRow[];
  total: number;
}

/** The full editable tree the editor loads (default locale/currency; no earn). */
export interface ProductAdminDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  basePriceCents: number;
  promoPriceCents: number | null;
  currency: string;
  brand: string | null;
  gender: string | null;
  ageRange: string | null;
  mpn: string | null;
  stockMode: string;
  stockQty: number | null;
  productType: string;
  recipeNotes: string | null;
  sortOrder: number;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  categoryIds: string[];
  storeIds: string[] | null;
  options: { id: string; name: string; sortOrder: number; values: { id: string; label: string; sortOrder: number }[] }[];
  variants: {
    id: string;
    sku: string | null;
    priceCents: number;
    promoPriceCents: number | null;
    isDefault: boolean;
    sortOrder: number;
    optionValueIds: string[];
    ingredients: {
      ingredientId: string;
      name: string;
      unit: string;
      quantity: number;
      visibleToCustomer: boolean;
      removable: boolean;
      costPerUnitCents: number;
      sortOrder: number;
    }[];
    /** Σ(quantity × ingredient cost) — the variant's COGS. */
    costCents: number;
    /** (price − cost) / price, 0..100; null when price is 0. */
    marginPct: number | null;
  }[];
  modifierGroups: {
    id: string;
    name: string;
    selectionType: string;
    minSelect: number;
    maxSelect: number | null;
    required: boolean;
    sortOrder: number;
    options: { id: string; name: string; priceDeltaCents: number; pointsDelta: number | null; sortOrder: number }[];
  }[];
  addonGroups: {
    id: string;
    name: string;
    selectionType: string;
    minSelect: number;
    maxSelect: number | null;
    required: boolean;
    sortOrder: number;
    items: { id: string; addonId: string; name: string; priceDeltaCents: number; sortOrder: number }[];
  }[];
  images: { id: string; url: string; alt: string | null; variantId: string | null; sortOrder: number }[];
}

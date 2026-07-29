import { z } from "zod";

/**
 * Taxonomy for the supply catalogs (add-ons, ingredients). Deliberately NOT the
 * storefront `category` table, which classifies products and carries its own
 * `product_category` join.
 */
export const catalogCategoryKind = z.enum(["addon", "ingredient"]);
export type CatalogCategoryKind = z.infer<typeof catalogCategoryKind>;

export const catalogCategoryListInputSchema = z.object({
  kind: catalogCategoryKind,
});

export const catalogCategoryCreateSchema = z.object({
  kind: catalogCategoryKind,
  name: z.string().trim().min(1).max(60),
  sortOrder: z.number().int().min(0).default(0),
});

export const catalogCategoryUpdateSchema = catalogCategoryCreateSchema
  .omit({ kind: true })
  .extend({ id: z.string().min(1) });

export const catalogCategoryIdSchema = z.object({ id: z.string().min(1) });

export type CatalogCategoryCreateInput = z.infer<typeof catalogCategoryCreateSchema>;
export type CatalogCategoryUpdateInput = z.infer<typeof catalogCategoryUpdateSchema>;

export interface CatalogCategoryRow {
  id: string;
  kind: CatalogCategoryKind;
  name: string;
  sortOrder: number;
  /** How many catalog entries (add-ons or ingredients) sit in this category. */
  memberCount: number;
  /**
   * Products whose add-on group resolves through this category. Editing the
   * category changes what those products offer, so the UI warns with this
   * number before saving. Always 0 for `ingredient` categories.
   */
  productCount: number;
}

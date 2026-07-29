import { z } from "zod";

import { listQueryBase } from "../_shared/list";

/** Canonical units. Previously this list lived only in the admin component, so
 *  nothing stopped the API storing "gramos" and "g" as separate units. */
export const ingredientUnits = ["u", "g", "kg", "ml", "l", "oz", "cda", "cdta"] as const;
export const ingredientUnit = z.enum(ingredientUnits);
export type IngredientUnit = z.infer<typeof ingredientUnit>;

export const ingredientListInputSchema = listQueryBase.extend({
  categoryId: z.array(z.string().min(1)).default([]),
  unit: z.array(z.string().max(12)).default([]),
  /** Archived rows are hidden unless explicitly asked for. */
  includeArchived: z.boolean().default(false),
});
export type IngredientListInput = z.infer<typeof ingredientListInputSchema>;

export const ingredientCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  unit: ingredientUnit.default("u"),
  costPerUnitCents: z.number().int().min(0).default(0),
  categoryId: z.string().min(1).nullish(),
});

export const ingredientUpdateSchema = ingredientCreateSchema.extend({
  id: z.string().min(1),
});

export const ingredientIdSchema = z.object({ id: z.string().min(1) });
export const ingredientArchiveSchema = z.object({
  id: z.string().min(1),
  archived: z.boolean(),
});

export type IngredientCreateInput = z.infer<typeof ingredientCreateSchema>;
export type IngredientUpdateInput = z.infer<typeof ingredientUpdateSchema>;

export interface IngredientRow {
  id: string;
  name: string;
  unit: string;
  costPerUnitCents: number;
  categoryId: string | null;
  categoryName: string | null;
  archivedAt: Date | null;
  /** Distinct products whose recipes reference this ingredient. */
  productCount: number;
}

/** Where an ingredient is used — powers the detail drawer and the pre-delete
 *  check, replacing the raw `FOREIGN KEY constraint failed` users used to get. */
export interface IngredientUsage {
  products: {
    productId: string;
    productName: string;
    variants: { variantId: string; label: string; quantity: number }[];
  }[];
  /** Add-ons pointing at this ingredient. Deleting it would unlink them
   *  silently (`addon.ingredientId` is `ON DELETE set null`). */
  addons: { id: string; name: string }[];
  canDelete: boolean;
}

import { z } from "zod";

import { listQueryBase } from "../_shared/list";

export const addonListInputSchema = listQueryBase.extend({
  categoryId: z.array(z.string().min(1)).default([]),
  active: z.array(z.enum(["true", "false"])).default([]),
  /** Only add-ons linked to a stocked ingredient (or only standalone ones). */
  linked: z.array(z.enum(["true", "false"])).default([]),
});
export type AddonListInput = z.infer<typeof addonListInputSchema>;

export const addonCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).nullish(),
  priceDeltaCents: z.number().int().min(0).default(0),
  /** Manual cost. Ignored when `ingredientId` is set — the cost is derived from
   *  the ingredient then, so it can't drift from the recipe. */
  costCents: z.number().int().min(0).default(0),
  ingredientId: z.string().min(1).nullish(),
  /** How much of the linked ingredient one add-on consumes (30 g of perlas).
   *  Required when `ingredientId` is set; the unit comes from the ingredient. */
  ingredientQty: z.number().min(0).nullish(),
  categoryId: z.string().min(1).nullish(),
  sku: z.string().max(80).nullish(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().min(0).default(0),
});

export const addonUpdateSchema = addonCreateSchema.extend({ id: z.string().min(1) });
export const addonIdSchema = z.object({ id: z.string().min(1) });

export type AddonCreateInput = z.infer<typeof addonCreateSchema>;
export type AddonUpdateInput = z.infer<typeof addonUpdateSchema>;

export interface AddonRow {
  id: string;
  name: string;
  description: string | null;
  priceDeltaCents: number;
  /** Effective cost: derived from the ingredient when linked, else the manual
   *  `costCents`. Callers should treat this as read-only. */
  costCents: number;
  /** True when `costCents` came from the linked ingredient rather than input. */
  costIsDerived: boolean;
  ingredientId: string | null;
  ingredientName: string | null;
  ingredientUnit: string | null;
  ingredientQty: number | null;
  categoryId: string | null;
  categoryName: string | null;
  sku: string | null;
  active: boolean;
  sortOrder: number;
}

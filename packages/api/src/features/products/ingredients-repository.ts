import type { db as Db } from "@loyalty/db";
import { ingredient } from "@loyalty/db/schema";
import { and, asc, eq, like } from "drizzle-orm";

import type {
  IngredientCreateInput,
  IngredientRow,
  IngredientUpdateInput,
} from "./write-schemas";

/** Org-level ingredient catalog (recipes reference these; drives COGS). */
export class IngredientsRepository {
  constructor(private readonly db: typeof Db) {}

  async list(orgId: string, search?: string): Promise<IngredientRow[]> {
    const conds = [eq(ingredient.organizationId, orgId)];
    if (search) conds.push(like(ingredient.name, `%${search}%`));
    const rows = await this.db
      .select({
        id: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        costPerUnitCents: ingredient.costPerUnitCents,
      })
      .from(ingredient)
      .where(and(...conds))
      .orderBy(asc(ingredient.name))
      .limit(200);
    return rows;
  }

  async create(orgId: string, input: IngredientCreateInput): Promise<IngredientRow> {
    const id = crypto.randomUUID();
    await this.db.insert(ingredient).values({
      id,
      organizationId: orgId,
      name: input.name.trim(),
      unit: input.unit,
      costPerUnitCents: input.costPerUnitCents,
    });
    return { id, name: input.name.trim(), unit: input.unit, costPerUnitCents: input.costPerUnitCents };
  }

  async update(orgId: string, input: IngredientUpdateInput): Promise<void> {
    await this.db
      .update(ingredient)
      .set({
        name: input.name.trim(),
        unit: input.unit,
        costPerUnitCents: input.costPerUnitCents,
        updatedAt: new Date(),
      })
      .where(and(eq(ingredient.organizationId, orgId), eq(ingredient.id, input.id)));
  }

  /** Delete a catalog ingredient. Throws (FK restrict) if any recipe uses it. */
  async remove(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(ingredient)
      .where(and(eq(ingredient.organizationId, orgId), eq(ingredient.id, id)));
  }
}

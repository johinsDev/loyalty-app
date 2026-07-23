import type { db as Db } from "@loyalty/db";
import { addon, ingredient } from "@loyalty/db/schema";
import { and, asc, eq, like } from "drizzle-orm";

import type { AddonCreateInput, AddonRow, AddonUpdateInput } from "./write-schemas";

/**
 * Org-level add-on catalog — reusable, sellable extras attached to products via
 * groups. An add-on may link to a stocked `ingredient` (cost/stock/recipe); the
 * catalog price is authoritative (no per-product override).
 */
export class AddonsRepository {
  constructor(private readonly db: typeof Db) {}

  private baseSelect() {
    return this.db
      .select({
        id: addon.id,
        name: addon.name,
        description: addon.description,
        priceDeltaCents: addon.priceDeltaCents,
        costCents: addon.costCents,
        ingredientId: addon.ingredientId,
        ingredientName: ingredient.name,
        sku: addon.sku,
        active: addon.active,
      })
      .from(addon)
      .leftJoin(ingredient, eq(ingredient.id, addon.ingredientId));
  }

  async list(orgId: string, search?: string): Promise<AddonRow[]> {
    const conds = [eq(addon.organizationId, orgId)];
    if (search) conds.push(like(addon.name, `%${search}%`));
    return this.baseSelect()
      .where(and(...conds))
      .orderBy(asc(addon.sortOrder), asc(addon.name))
      .limit(200);
  }

  async get(orgId: string, id: string): Promise<AddonRow | null> {
    const [row] = await this.baseSelect()
      .where(and(eq(addon.organizationId, orgId), eq(addon.id, id)))
      .limit(1);
    return row ?? null;
  }

  async create(orgId: string, input: AddonCreateInput): Promise<AddonRow> {
    const id = crypto.randomUUID();
    await this.db.insert(addon).values({
      id,
      organizationId: orgId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      priceDeltaCents: input.priceDeltaCents,
      costCents: input.costCents,
      ingredientId: input.ingredientId ?? null,
      sku: input.sku?.trim() || null,
      active: input.active,
    });
    return (await this.get(orgId, id))!;
  }

  async update(orgId: string, input: AddonUpdateInput): Promise<void> {
    await this.db
      .update(addon)
      .set({
        name: input.name.trim(),
        description: input.description?.trim() || null,
        priceDeltaCents: input.priceDeltaCents,
        costCents: input.costCents,
        ingredientId: input.ingredientId ?? null,
        sku: input.sku?.trim() || null,
        active: input.active,
        updatedAt: new Date(),
      })
      .where(and(eq(addon.organizationId, orgId), eq(addon.id, input.id)));
  }

  /** Delete a catalog add-on. Cascades its group attachments (addon_group_item). */
  async remove(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(addon)
      .where(and(eq(addon.organizationId, orgId), eq(addon.id, id)));
  }
}

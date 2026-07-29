import type { db as Db } from "@loyalty/db";
import { addon, catalogCategory, ingredient } from "@loyalty/db/schema";
import { and, asc, eq, inArray, like, type SQL, sql } from "drizzle-orm";

import { buildOrderBy, type ListResult, pageCountOf, pageOffset } from "../_shared/list";
import type {
  AddonCreateInput,
  AddonListInput,
  AddonRow,
  AddonUpdateInput,
} from "./schemas";

/**
 * Org-level add-on catalog — reusable, sellable extras attached to products via
 * groups. An add-on may link to a stocked `ingredient`, in which case its cost
 * is derived (`ingredientQty × costPerUnitCents`) rather than typed, so it can
 * never drift from the recipe.
 */
export class AddonsRepository {
  constructor(private readonly db: typeof Db) {}

  /** Effective cost per add-on: derived when linked, manual otherwise. */
  static effectiveCost(row: {
    costCents: number;
    ingredientQty: number | null;
    ingredientCostPerUnitCents: number | null;
  }): { costCents: number; costIsDerived: boolean } {
    if (row.ingredientQty != null && row.ingredientCostPerUnitCents != null) {
      return {
        costCents: Math.round(row.ingredientQty * row.ingredientCostPerUnitCents),
        costIsDerived: true,
      };
    }
    return { costCents: row.costCents, costIsDerived: false };
  }

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
        ingredientUnit: ingredient.unit,
        ingredientCostPerUnitCents: ingredient.costPerUnitCents,
        ingredientQty: addon.ingredientQty,
        categoryId: addon.categoryId,
        categoryName: catalogCategory.name,
        sku: addon.sku,
        active: addon.active,
        sortOrder: addon.sortOrder,
      })
      .from(addon)
      .leftJoin(ingredient, eq(ingredient.id, addon.ingredientId))
      .leftJoin(catalogCategory, eq(catalogCategory.id, addon.categoryId));
  }

  private static toRow(r: {
    costCents: number;
    ingredientQty: number | null;
    ingredientCostPerUnitCents: number | null;
    [k: string]: unknown;
  }): AddonRow {
    const { ingredientCostPerUnitCents: _drop, ...rest } = r;
    const cost = AddonsRepository.effectiveCost(r);
    return { ...(rest as unknown as AddonRow), ...cost };
  }

  async list(orgId: string, input: AddonListInput): Promise<ListResult<AddonRow>> {
    const conds: SQL[] = [eq(addon.organizationId, orgId)];
    if (input.q) conds.push(like(addon.name, `%${input.q}%`));
    if (input.categoryId.length) conds.push(inArray(addon.categoryId, input.categoryId));
    if (input.active.length === 1) conds.push(eq(addon.active, input.active[0] === "true"));
    if (input.linked.length === 1) {
      conds.push(
        input.linked[0] === "true"
          ? sql`${addon.ingredientId} is not null`
          : sql`${addon.ingredientId} is null`,
      );
    }
    const where = and(...conds);

    const orderBy = buildOrderBy(
      input.sort,
      {
        name: addon.name,
        priceDeltaCents: addon.priceDeltaCents,
        costCents: addon.costCents,
        active: addon.active,
      },
      [asc(addon.sortOrder), asc(addon.name)],
    );

    const [rows, totalRows] = await Promise.all([
      this.baseSelect()
        .where(where)
        .orderBy(...orderBy)
        .limit(input.perPage)
        .offset(pageOffset(input.page, input.perPage)),
      this.db.select({ value: sql<number>`count(*)` }).from(addon).where(where),
    ]);

    const total = Number(totalRows[0]?.value ?? 0);
    return {
      rows: rows.map((r) => AddonsRepository.toRow(r)),
      total,
      pageCount: pageCountOf(total, input.perPage),
    };
  }

  /** Lean list for the pickers (product editor, rewards). No pagination — the
   *  caller filters client-side within one category. */
  async listForPicker(orgId: string, categoryId?: string | null): Promise<AddonRow[]> {
    const conds: SQL[] = [eq(addon.organizationId, orgId), eq(addon.active, true)];
    if (categoryId) conds.push(eq(addon.categoryId, categoryId));
    const rows = await this.baseSelect()
      .where(and(...conds))
      .orderBy(asc(addon.sortOrder), asc(addon.name));
    return rows.map((r) => AddonsRepository.toRow(r));
  }

  async get(orgId: string, id: string): Promise<AddonRow | null> {
    const [row] = await this.baseSelect()
      .where(and(eq(addon.organizationId, orgId), eq(addon.id, id)))
      .limit(1);
    return row ? AddonsRepository.toRow(row) : null;
  }

  private static writeValues(input: AddonCreateInput) {
    const linked = input.ingredientId ?? null;
    return {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      priceDeltaCents: input.priceDeltaCents,
      // A linked add-on derives its cost on read; zero it here so a stale manual
      // value can never resurface if the ingredient link is later removed.
      costCents: linked ? 0 : input.costCents,
      ingredientId: linked,
      ingredientQty: linked ? (input.ingredientQty ?? 0) : null,
      categoryId: input.categoryId ?? null,
      sku: input.sku?.trim() || null,
      active: input.active,
      sortOrder: input.sortOrder,
    };
  }

  async create(orgId: string, input: AddonCreateInput): Promise<AddonRow> {
    const id = crypto.randomUUID();
    await this.db
      .insert(addon)
      .values({ id, organizationId: orgId, ...AddonsRepository.writeValues(input) });
    return (await this.get(orgId, id))!;
  }

  async update(orgId: string, input: AddonUpdateInput): Promise<void> {
    await this.db
      .update(addon)
      .set({ ...AddonsRepository.writeValues(input), updatedAt: new Date() })
      .where(and(eq(addon.organizationId, orgId), eq(addon.id, input.id)));
  }

  /** Delete a catalog add-on. Cascades its group attachments (addon_group_item);
   *  sales history is unaffected thanks to the `purchase_item_addon` snapshot. */
  async remove(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(addon)
      .where(and(eq(addon.organizationId, orgId), eq(addon.id, id)));
  }
}

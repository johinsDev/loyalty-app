import type { db as Db } from "@loyalty/db";
import {
  addon,
  catalogCategory,
  ingredient,
  product,
  productOptionValue,
  productVariant,
  productVariantValue,
  variantIngredient,
} from "@loyalty/db/schema";
import { and, asc, eq, inArray, isNull, like, type SQL, sql } from "drizzle-orm";

import { buildOrderBy, type ListResult, pageCountOf, pageOffset } from "../_shared/list";
import type {
  IngredientCreateInput,
  IngredientListInput,
  IngredientRow,
  IngredientUpdateInput,
  IngredientUsage,
} from "./schemas";

/** Org-level ingredient catalog (recipes reference these; drives COGS). */
export class IngredientsRepository {
  constructor(private readonly db: typeof Db) {}

  /** Distinct products per ingredient. Relies on
   *  `variant_ingredient_ingredient_idx` — without it this is a full scan. */
  private productCountExpr() {
    // Fully qualified on purpose: interpolating drizzle column objects into a
    // raw `sql` template renders them UNQUALIFIED, so the correlated reference
    // to the outer `ingredient.id` would bind to an inner table and return 0.
    return sql<number>`(
      select count(distinct "product_variant"."product_id")
      from "variant_ingredient"
      join "product_variant" on "product_variant"."id" = "variant_ingredient"."variant_id"
      where "variant_ingredient"."ingredient_id" = "ingredient"."id"
    )`;
  }

  async list(
    orgId: string,
    input: IngredientListInput,
  ): Promise<ListResult<IngredientRow>> {
    const conds: SQL[] = [eq(ingredient.organizationId, orgId)];
    if (input.q) conds.push(like(ingredient.name, `%${input.q}%`));
    if (input.categoryId.length)
      conds.push(inArray(ingredient.categoryId, input.categoryId));
    if (input.unit.length) conds.push(inArray(ingredient.unit, input.unit));
    if (!input.includeArchived) conds.push(isNull(ingredient.archivedAt));
    const where = and(...conds);

    const orderBy = buildOrderBy(
      input.sort,
      {
        name: ingredient.name,
        unit: ingredient.unit,
        costPerUnitCents: ingredient.costPerUnitCents,
      },
      [asc(ingredient.name)],
    );

    const [rows, totalRows] = await Promise.all([
      this.db
        .select({
          id: ingredient.id,
          name: ingredient.name,
          unit: ingredient.unit,
          costPerUnitCents: ingredient.costPerUnitCents,
          categoryId: ingredient.categoryId,
          categoryName: catalogCategory.name,
          archivedAt: ingredient.archivedAt,
          productCount: this.productCountExpr(),
        })
        .from(ingredient)
        .leftJoin(catalogCategory, eq(catalogCategory.id, ingredient.categoryId))
        .where(where)
        .orderBy(...orderBy)
        .limit(input.perPage)
        .offset(pageOffset(input.page, input.perPage)),
      this.db.select({ value: sql<number>`count(*)` }).from(ingredient).where(where),
    ]);

    const total = Number(totalRows[0]?.value ?? 0);
    return {
      rows: rows.map((r) => ({ ...r, productCount: Number(r.productCount ?? 0) })),
      total,
      pageCount: pageCountOf(total, input.perPage),
    };
  }

  /** Lean list for the recipe combobox (active only, no pagination). */
  async listForPicker(orgId: string): Promise<IngredientRow[]> {
    const rows = await this.db
      .select({
        id: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        costPerUnitCents: ingredient.costPerUnitCents,
        categoryId: ingredient.categoryId,
        categoryName: catalogCategory.name,
        archivedAt: ingredient.archivedAt,
      })
      .from(ingredient)
      .leftJoin(catalogCategory, eq(catalogCategory.id, ingredient.categoryId))
      .where(and(eq(ingredient.organizationId, orgId), isNull(ingredient.archivedAt)))
      .orderBy(asc(ingredient.name));
    return rows.map((r) => ({ ...r, productCount: 0 }));
  }

  /**
   * Reverse lookup: which products/variants use this ingredient, plus the
   * add-ons linked to it. The first traversal in the codebase that goes
   * ingredient → variant rather than the other way around.
   */
  async usage(orgId: string, id: string): Promise<IngredientUsage> {
    const [lines, addonRows] = await Promise.all([
      this.db
        .select({
          productId: product.id,
          productName: product.name,
          variantId: productVariant.id,
          quantity: variantIngredient.quantity,
          optionLabel: productOptionValue.label,
        })
        .from(variantIngredient)
        .innerJoin(productVariant, eq(productVariant.id, variantIngredient.variantId))
        .innerJoin(product, eq(product.id, productVariant.productId))
        .leftJoin(
          productVariantValue,
          eq(productVariantValue.variantId, productVariant.id),
        )
        .leftJoin(
          productOptionValue,
          eq(productOptionValue.id, productVariantValue.optionValueId),
        )
        .where(
          and(eq(variantIngredient.ingredientId, id), eq(product.organizationId, orgId)),
        )
        .orderBy(asc(product.name)),
      this.db
        .select({ id: addon.id, name: addon.name })
        .from(addon)
        .where(and(eq(addon.organizationId, orgId), eq(addon.ingredientId, id)))
        .orderBy(asc(addon.name)),
    ]);

    // One row per (variant × option axis) — fold the axes into a single label.
    const byProduct = new Map<string, IngredientUsage["products"][number]>();
    const labels = new Map<string, string[]>();
    for (const l of lines) {
      const entry = byProduct.get(l.productId) ?? {
        productId: l.productId,
        productName: l.productName,
        variants: [],
      };
      if (!entry.variants.some((v) => v.variantId === l.variantId)) {
        entry.variants.push({ variantId: l.variantId, label: "", quantity: l.quantity });
      }
      if (l.optionLabel) {
        labels.set(l.variantId, [...(labels.get(l.variantId) ?? []), l.optionLabel]);
      }
      byProduct.set(l.productId, entry);
    }
    for (const p of byProduct.values()) {
      for (const v of p.variants) {
        v.label = labels.get(v.variantId)?.join(" / ") ?? "Único";
      }
    }

    const products = [...byProduct.values()];
    return { products, addons: addonRows, canDelete: products.length === 0 };
  }

  async get(orgId: string, id: string): Promise<IngredientRow | null> {
    const [row] = await this.db
      .select({
        id: ingredient.id,
        name: ingredient.name,
        unit: ingredient.unit,
        costPerUnitCents: ingredient.costPerUnitCents,
        categoryId: ingredient.categoryId,
        categoryName: catalogCategory.name,
        archivedAt: ingredient.archivedAt,
        productCount: this.productCountExpr(),
      })
      .from(ingredient)
      .leftJoin(catalogCategory, eq(catalogCategory.id, ingredient.categoryId))
      .where(and(eq(ingredient.organizationId, orgId), eq(ingredient.id, id)))
      .limit(1);
    return row ? { ...row, productCount: Number(row.productCount ?? 0) } : null;
  }

  async create(orgId: string, input: IngredientCreateInput): Promise<{ id: string }> {
    const id = crypto.randomUUID();
    await this.db.insert(ingredient).values({
      id,
      organizationId: orgId,
      name: input.name.trim(),
      unit: input.unit,
      costPerUnitCents: input.costPerUnitCents,
      categoryId: input.categoryId ?? null,
    });
    return { id };
  }

  async update(orgId: string, input: IngredientUpdateInput): Promise<void> {
    await this.db
      .update(ingredient)
      .set({
        name: input.name.trim(),
        unit: input.unit,
        costPerUnitCents: input.costPerUnitCents,
        categoryId: input.categoryId ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(ingredient.organizationId, orgId), eq(ingredient.id, input.id)));
  }

  /** Shelve without touching history — the only way to retire an ingredient
   *  that recipes already reference (the FK is `restrict`). */
  async setArchived(orgId: string, id: string, archived: boolean): Promise<void> {
    await this.db
      .update(ingredient)
      .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(ingredient.organizationId, orgId), eq(ingredient.id, id)));
  }

  async remove(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(ingredient)
      .where(and(eq(ingredient.organizationId, orgId), eq(ingredient.id, id)));
  }
}

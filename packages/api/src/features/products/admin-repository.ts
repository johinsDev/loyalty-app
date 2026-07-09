import type { db as Db } from "@loyalty/db";
import {
  category,
  modifierGroup,
  modifierOption,
  product,
  productCategory,
  productImage,
  productOption,
  productOptionValue,
  productVariant,
  productVariantValue,
  variantIngredient,
} from "@loyalty/db/schema";
import { and, asc, desc, eq, inArray, like, sql } from "drizzle-orm";

/* eslint-disable no-await-in-loop -- writes inside one transaction are
   intentionally sequential: child-collection order is load-bearing for FKs
   (values before variant-values, variants before their images). */
import { partitionById } from "./diff";
import { slugify, slugSuffix } from "../_shared/slugify";
import type {
  ProductAdminDetail,
  ProductAdminList,
  ProductAdminListInput,
  ProductAdminRow,
  ProductUpsertInput,
} from "./write-schemas";

const DRAFT_NAME = "Borrador";

/**
 * Admin write access for products. Separate from the read `ProductsRepository`
 * (menu/PWA). The upsert diffs every child collection BY ID so the
 * variant/modifierOption ids that promo + reward JSON rules reference stay
 * stable across edits — a blind replace-all would silently break those refs.
 */
export class ProductsAdminRepository {
  constructor(private readonly db: typeof Db) {}

  private async slugExists(
    orgId: string,
    slug: string,
    excludeId: string,
  ): Promise<boolean> {
    const rows = await this.db
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.organizationId, orgId), eq(product.slug, slug)))
      .limit(2);
    return rows.some((r) => r.id !== excludeId);
  }

  private async resolveSlug(
    orgId: string,
    desired: string,
    selfId: string,
  ): Promise<string> {
    const base = slugify(desired) || `producto-${slugSuffix()}`;
    let candidate = base;
    while (await this.slugExists(orgId, candidate, selfId)) {
      candidate = `${base}-${slugSuffix()}`;
    }
    return candidate;
  }

  /** Insert a blank draft so the editor has an id to attach images/edits to. */
  async createDraft(orgId: string): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.insert(product).values({
      id,
      organizationId: orgId,
      name: DRAFT_NAME,
      slug: `borrador-${slugSuffix()}`,
      status: "draft",
      basePriceCents: 0,
    });
    return id;
  }

  async getAdmin(orgId: string, id: string): Promise<ProductAdminDetail | null> {
    const p = await this.db.query.product.findFirst({
      where: and(eq(product.organizationId, orgId), eq(product.id, id)),
      with: {
        images: { orderBy: asc(productImage.sortOrder) },
        options: {
          orderBy: asc(productOption.sortOrder),
          with: { values: { orderBy: asc(productOptionValue.sortOrder) } },
        },
        variants: {
          orderBy: asc(productVariant.sortOrder),
          with: {
            values: true,
            ingredients: {
              orderBy: asc(variantIngredient.sortOrder),
              with: { ingredient: true },
            },
          },
        },
        modifierGroups: {
          orderBy: asc(modifierGroup.sortOrder),
          with: { options: { orderBy: asc(modifierOption.sortOrder) } },
        },
        categories: true,
      },
    });
    if (!p) return null;
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      status: p.status,
      basePriceCents: p.basePriceCents,
      promoPriceCents: p.promoPriceCents,
      currency: p.currency,
      brand: p.brand,
      gender: p.gender,
      ageRange: p.ageRange,
      mpn: p.mpn,
      stockMode: p.stockMode,
      stockQty: p.stockQty,
      productType: p.productType,
      recipeNotes: p.recipeNotes,
      sortOrder: p.sortOrder,
      seoTitle: p.seoTitle,
      seoDescription: p.seoDescription,
      ogImageUrl: p.ogImageUrl,
      categoryIds: p.categories.map((c) => c.categoryId),
      options: p.options.map((o) => ({
        id: o.id,
        name: o.name,
        sortOrder: o.sortOrder,
        values: o.values.map((v) => ({ id: v.id, label: v.label, sortOrder: v.sortOrder })),
      })),
      variants: p.variants.map((v) => {
        const ingredients = v.ingredients.map((vi) => ({
          ingredientId: vi.ingredientId,
          name: vi.ingredient.name,
          unit: vi.ingredient.unit,
          quantity: vi.quantity,
          visibleToCustomer: vi.visibleToCustomer,
          costPerUnitCents: vi.ingredient.costPerUnitCents,
          sortOrder: vi.sortOrder,
        }));
        const costCents = Math.round(
          ingredients.reduce((s, i) => s + i.quantity * i.costPerUnitCents, 0),
        );
        const marginPct =
          v.priceCents > 0
            ? Math.round(((v.priceCents - costCents) / v.priceCents) * 100)
            : null;
        return {
          id: v.id,
          sku: v.sku,
          priceCents: v.priceCents,
          isDefault: v.isDefault,
          sortOrder: v.sortOrder,
          optionValueIds: v.values.map((vv) => vv.optionValueId),
          ingredients,
          costCents,
          marginPct,
        };
      }),
      modifierGroups: p.modifierGroups.map((g) => ({
        id: g.id,
        name: g.name,
        selectionType: g.selectionType,
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        required: g.required,
        sortOrder: g.sortOrder,
        options: g.options.map((mo) => ({
          id: mo.id,
          name: mo.name,
          priceDeltaCents: mo.priceDeltaCents,
          pointsDelta: mo.pointsDelta,
          sortOrder: mo.sortOrder,
        })),
      })),
      images: p.images.map((img) => ({
        id: img.id,
        url: img.url,
        alt: img.alt,
        variantId: img.variantId,
        sortOrder: img.sortOrder,
      })),
    };
  }

  /**
   * Transactional upsert of the whole product tree, diffing every collection by
   * id. Order matters for FKs: option-values before variant-values that
   * reference them; variants before their images. Deleting a removed
   * option/variant cascades its children (values, variant-values, images).
   */
  async upsert(orgId: string, input: ProductUpsertInput): Promise<string> {
    const owned = await this.db
      .select({ id: product.id })
      .from(product)
      .where(and(eq(product.organizationId, orgId), eq(product.id, input.id)))
      .limit(1);
    if (!owned[0]) throw new Error("product-not-found");

    const slug = await this.resolveSlug(orgId, input.name, input.id);

    await this.db.transaction(async (tx) => {
      await tx
        .update(product)
        .set({
          name: input.name,
          slug,
          description: input.description ?? null,
          status: input.status,
          basePriceCents: input.basePriceCents,
          promoPriceCents: input.promoPriceCents ?? null,
          currency: input.currency,
          brand: input.brand ?? null,
          gender: input.gender ?? null,
          ageRange: input.ageRange ?? null,
          mpn: input.mpn ?? null,
          stockMode: input.stockMode,
          stockQty: input.stockQty ?? null,
          productType: input.productType,
          recipeNotes: input.recipeNotes ?? null,
          sortOrder: input.sortOrder,
          seoTitle: input.seoTitle ?? null,
          seoDescription: input.seoDescription ?? null,
          ogImageUrl: input.ogImageUrl ? input.ogImageUrl : null,
          updatedAt: new Date(),
        })
        .where(eq(product.id, input.id));

      // --- categories (link table, diff by categoryId) ---
      const existingCats = (
        await tx
          .select({ categoryId: productCategory.categoryId })
          .from(productCategory)
          .where(eq(productCategory.productId, input.id))
      ).map((r) => r.categoryId);
      const keepCats = new Set(input.categoryIds);
      const dropCats = existingCats.filter((c) => !keepCats.has(c));
      if (dropCats.length > 0) {
        await tx
          .delete(productCategory)
          .where(
            and(
              eq(productCategory.productId, input.id),
              inArray(productCategory.categoryId, dropCats),
            ),
          );
      }
      const addCats = input.categoryIds.filter((c) => !existingCats.includes(c));
      if (addCats.length > 0) {
        await tx
          .insert(productCategory)
          .values(addCats.map((categoryId) => ({ productId: input.id, categoryId })));
      }

      // --- options + their values (delete removed first → cascades values) ---
      await this.#syncChildren(
        tx,
        productOption,
        productOption.id,
        productOption.productId,
        "productId",
        input.id,
        input.options.map((o) => ({ id: o.id, name: o.name, sortOrder: o.sortOrder })),
      );
      for (const o of input.options) {
        await this.#syncChildren(
          tx,
          productOptionValue,
          productOptionValue.id,
          productOptionValue.optionId,
          "optionId",
          o.id,
          o.values.map((v) => ({ id: v.id, label: v.label, sortOrder: v.sortOrder })),
        );
      }

      // --- variants (delete removed → cascades variant_values + variant images) ---
      await this.#syncChildren(
        tx,
        productVariant,
        productVariant.id,
        productVariant.productId,
        "productId",
        input.id,
        input.variants.map((v) => ({
          id: v.id,
          sku: v.sku ?? null,
          priceCents: v.priceCents,
          isDefault: v.isDefault,
          sortOrder: v.sortOrder,
        })),
      );
      // variant_value has no own id (composite pk, no external refs) → replace per variant.
      for (const v of input.variants) {
        await tx
          .delete(productVariantValue)
          .where(eq(productVariantValue.variantId, v.id));
        if (v.optionValueIds.length > 0) {
          await tx
            .insert(productVariantValue)
            .values(v.optionValueIds.map((optionValueId) => ({ variantId: v.id, optionValueId })));
        }
        // Recipe lines: no external refs → replaced wholesale per variant.
        await tx
          .delete(variantIngredient)
          .where(eq(variantIngredient.variantId, v.id));
        if (v.ingredients.length > 0) {
          await tx.insert(variantIngredient).values(
            v.ingredients.map((ing) => ({
              variantId: v.id,
              ingredientId: ing.ingredientId,
              quantity: ing.quantity,
              visibleToCustomer: ing.visibleToCustomer,
              sortOrder: ing.sortOrder,
            })),
          );
        }
      }

      // --- modifier groups + their options ---
      await this.#syncChildren(
        tx,
        modifierGroup,
        modifierGroup.id,
        modifierGroup.productId,
        "productId",
        input.id,
        input.modifierGroups.map((g) => ({
          id: g.id,
          name: g.name,
          selectionType: g.selectionType,
          minSelect: g.minSelect,
          maxSelect: g.maxSelect ?? null,
          required: g.required,
          sortOrder: g.sortOrder,
        })),
      );
      for (const g of input.modifierGroups) {
        await this.#syncChildren(
          tx,
          modifierOption,
          modifierOption.id,
          modifierOption.groupId,
          "groupId",
          g.id,
          g.options.map((mo) => ({
            id: mo.id,
            name: mo.name,
            priceDeltaCents: mo.priceDeltaCents,
            pointsDelta: mo.pointsDelta ?? null,
            sortOrder: mo.sortOrder,
          })),
        );
      }

      // --- images (all referenced variants survive by now) ---
      await this.#syncChildren(
        tx,
        productImage,
        productImage.id,
        productImage.productId,
        "productId",
        input.id,
        input.images.map((img) => ({
          id: img.id,
          url: img.url,
          alt: img.alt ?? null,
          variantId: img.variantId ?? null,
          sortOrder: img.sortOrder,
        })),
      );
    });

    return input.id;
  }

  /**
   * Diff a child collection by id under one parent: delete rows no longer in
   * `rows`, then upsert each remaining row (insert new / update existing). Each
   * row object must carry its `id`; the rest of its keys are the mutable columns.
   */
  async #syncChildren(
    tx: Parameters<Parameters<(typeof Db)["transaction"]>[0]>[0],
    // drizzle table + columns are loosely typed here to keep the helper generic.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    table: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    idCol: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    parentCol: any,
    // The JS property key of the parent FK (e.g. "productId") — NOT the SQL
    // column name, which is what a drizzle column's `.name` would give.
    parentKey: string,
    parentId: string,
    rows: Array<{ id: string } & Record<string, unknown>>,
  ): Promise<void> {
    const existing = (await tx
      .select({ id: idCol })
      .from(table)
      .where(eq(parentCol, parentId))) as Array<{ id: string }>;
    const { toDelete } = partitionById(
      existing.map((e) => e.id),
      rows.map((r) => r.id),
    );
    if (toDelete.length > 0) {
      await tx.delete(table).where(inArray(idCol, toDelete));
    }
    for (const r of rows) {
      const { id: _id, ...cols } = r;
      await tx
        .insert(table)
        .values({ ...r, [parentKey]: parentId })
        .onConflictDoUpdate({ target: idCol, set: cols });
    }
  }

  async setStatus(orgId: string, id: string, status: string): Promise<void> {
    await this.db
      .update(product)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(product.organizationId, orgId), eq(product.id, id)));
  }

  async remove(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(product)
      .where(and(eq(product.organizationId, orgId), eq(product.id, id)));
  }

  async adminList(
    orgId: string,
    input: ProductAdminListInput,
  ): Promise<ProductAdminList> {
    const conds = [eq(product.organizationId, orgId)];
    if (input.status && input.status.length > 0) {
      conds.push(inArray(product.status, input.status));
    }
    if (input.search) {
      conds.push(like(product.name, `%${input.search}%`));
    }
    // Category facet → restrict to products linked to any of the given categories.
    let idFilter: string[] | null = null;
    if (input.categoryId && input.categoryId.length > 0) {
      const linked = await this.db
        .select({ productId: productCategory.productId })
        .from(productCategory)
        .where(inArray(productCategory.categoryId, input.categoryId));
      idFilter = [...new Set(linked.map((l) => l.productId))];
      if (idFilter.length === 0) return { rows: [], total: 0 };
      conds.push(inArray(product.id, idFilter));
    }

    const where = and(...conds);
    const orderCol =
      input.sort === "name"
        ? product.name
        : input.sort === "price"
          ? product.basePriceCents
          : product.updatedAt;
    const order = input.dir === "asc" ? asc(orderCol) : desc(orderCol);

    const [{ count } = { count: 0 }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(product)
      .where(where);

    const rows = await this.db
      .select()
      .from(product)
      .where(where)
      .orderBy(order, asc(product.id))
      .limit(input.perPage)
      .offset((input.page - 1) * input.perPage);

    const ids = rows.map((r) => r.id);
    const [variantCounts, images, cats] = await Promise.all([
      ids.length === 0
        ? Promise.resolve([] as { productId: string; c: number }[])
        : this.db
            .select({ productId: productVariant.productId, c: sql<number>`count(*)` })
            .from(productVariant)
            .where(inArray(productVariant.productId, ids))
            .groupBy(productVariant.productId),
      ids.length === 0
        ? Promise.resolve([] as { productId: string; url: string; sortOrder: number }[])
        : this.db
            .select({
              productId: productImage.productId,
              url: productImage.url,
              sortOrder: productImage.sortOrder,
            })
            .from(productImage)
            .where(
              and(inArray(productImage.productId, ids), sql`${productImage.variantId} is null`),
            )
            .orderBy(asc(productImage.sortOrder)),
      ids.length === 0
        ? Promise.resolve([] as { productId: string; name: string }[])
        : this.db
            .select({ productId: productCategory.productId, name: category.name })
            .from(productCategory)
            .innerJoin(category, eq(category.id, productCategory.categoryId))
            .where(inArray(productCategory.productId, ids)),
    ]);

    const variantCountBy = new Map(variantCounts.map((v) => [v.productId, v.c]));
    const firstImage = new Map<string, string>();
    for (const img of images) if (!firstImage.has(img.productId)) firstImage.set(img.productId, img.url);
    const catsBy = new Map<string, string[]>();
    for (const c of cats) {
      const arr = catsBy.get(c.productId) ?? [];
      arr.push(c.name);
      catsBy.set(c.productId, arr);
    }

    const out: ProductAdminRow[] = rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      status: p.status,
      basePriceCents: p.basePriceCents,
      currency: p.currency,
      imageUrl: firstImage.get(p.id) ?? null,
      variantCount: variantCountBy.get(p.id) ?? 0,
      categoryNames: catsBy.get(p.id) ?? [],
      updatedAt: p.updatedAt,
    }));
    return { rows: out, total: Number(count) };
  }
}

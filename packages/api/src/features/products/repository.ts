import type { db as Db } from "@loyalty/db";
import {
  category,
  categoryTranslation,
  modifierGroup,
  modifierOption,
  modifierOptionPrice,
  product,
  productCategory,
  productFavorite,
  productImage,
  productOption,
  productOptionValue,
  productPrice,
  productTranslation,
  productVariant,
  productVariantPrice,
  section,
  sectionProduct,
} from "@loyalty/db/schema";
import { and, asc, eq, gt, inArray, like, or, sql } from "drizzle-orm";

import type { LocaleContext } from "../_shared/localize";
import { pickPrice } from "../_shared/localize";
import { earnFor } from "./earn";
import type {
  MenuCard,
  MenuList,
  ProductDetail,
  SectionView,
} from "./schemas";

const SECTION_CARD_CAP = 12;

/** Plain-text snippet from rich (tiptap) HTML, for cards. */
function snippet(html: string | null, max = 90): string | null {
  if (!html) return null;
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

type Cursor = { s: number; i: string };

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString("base64url");
}
function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(Buffer.from(raw, "base64url").toString()) as Cursor;
    return typeof c.s === "number" && typeof c.i === "string" ? c : null;
  } catch {
    return null;
  }
}

/**
 * Drizzle access for the product catalog (menu). Only layer that touches the db.
 * List uses keyset pagination (sortOrder,id) for stable infinite scroll; detail
 * + sections use the relational query API. Earn previews are attached here via
 * the pure `earnFor` helper (price → points/stamp).
 */
export class ProductsRepository {
  constructor(private readonly db: typeof Db) {}

  async listProducts(input: {
    orgId: string;
    cursor?: string | null;
    pageSize: number;
    categorySlug?: string | null;
    sectionSlug?: string | null;
    search?: string | null;
    ctx: LocaleContext;
  }): Promise<MenuList> {
    const { orgId, pageSize } = input;
    const cur = decodeCursor(input.cursor);

    const conds = [
      eq(product.organizationId, orgId),
      eq(product.status, "active"),
    ];
    if (cur) {
      // keyset: (sortOrder, id) strictly after the cursor
      conds.push(
        or(
          gt(product.sortOrder, cur.s),
          and(eq(product.sortOrder, cur.s), gt(product.id, cur.i)),
        )!,
      );
    }
    if (input.search) {
      conds.push(like(product.name, `%${input.search}%`));
    }

    let ids: { id: string }[];
    if (input.sectionSlug) {
      ids = await this.db
        .select({ id: product.id, s: product.sortOrder })
        .from(product)
        .innerJoin(sectionProduct, eq(sectionProduct.productId, product.id))
        .innerJoin(section, eq(section.id, sectionProduct.sectionId))
        .where(and(...conds, eq(section.slug, input.sectionSlug)))
        .orderBy(asc(product.sortOrder), asc(product.id))
        .limit(pageSize + 1);
    } else if (input.categorySlug) {
      ids = await this.db
        .select({ id: product.id, s: product.sortOrder })
        .from(product)
        .innerJoin(productCategory, eq(productCategory.productId, product.id))
        .innerJoin(category, eq(category.id, productCategory.categoryId))
        .where(and(...conds, eq(category.slug, input.categorySlug)))
        .orderBy(asc(product.sortOrder), asc(product.id))
        .limit(pageSize + 1);
    } else {
      ids = await this.db
        .select({ id: product.id, s: product.sortOrder })
        .from(product)
        .where(and(...conds))
        .orderBy(asc(product.sortOrder), asc(product.id))
        .limit(pageSize + 1);
    }

    const page = ids.slice(0, pageSize);
    const hasMore = ids.length > pageSize;
    const cards = await this.cardsByIds(page.map((p) => p.id), input.ctx);

    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1]! as { id: string; s: number };
      nextCursor = encodeCursor({ s: last.s, i: last.id });
    }
    return { items: cards, nextCursor };
  }

  /** Compact cards for a set of product ids, preserving sortOrder,id order. */
  private async cardsByIds(
    productIds: string[],
    ctx: LocaleContext,
  ): Promise<MenuCard[]> {
    if (productIds.length === 0) return [];
    const rows = await this.db
      .select()
      .from(product)
      .where(inArray(product.id, productIds))
      .orderBy(asc(product.sortOrder), asc(product.id));

    // Per-locale name/description overrides + per-currency price overrides.
    const trByProduct = new Map<string, { name: string; description: string | null }>();
    if (ctx.locale !== ctx.defaultLocale) {
      const trs = await this.db
        .select()
        .from(productTranslation)
        .where(
          and(
            inArray(productTranslation.productId, productIds),
            eq(productTranslation.locale, ctx.locale),
          ),
        );
      for (const t of trs)
        trByProduct.set(t.productId, { name: t.name, description: t.description });
    }
    const priceByProduct = new Map<string, number>();
    if (ctx.currency !== ctx.defaultCurrency) {
      const prices = await this.db
        .select()
        .from(productPrice)
        .where(
          and(
            inArray(productPrice.productId, productIds),
            eq(productPrice.currency, ctx.currency),
          ),
        );
      for (const pr of prices) priceByProduct.set(pr.productId, pr.amountCents);
    }

    const images = await this.db
      .select({
        productId: productImage.productId,
        url: productImage.url,
        sortOrder: productImage.sortOrder,
      })
      .from(productImage)
      .where(
        and(
          inArray(productImage.productId, productIds),
          sql`${productImage.variantId} is null`,
        ),
      )
      .orderBy(asc(productImage.sortOrder));
    const firstImage = new Map<string, string>();
    for (const img of images) {
      if (!firstImage.has(img.productId)) firstImage.set(img.productId, img.url);
    }

    const cats = await this.db
      .select({ productId: productCategory.productId, slug: category.slug })
      .from(productCategory)
      .innerJoin(category, eq(category.id, productCategory.categoryId))
      .where(inArray(productCategory.productId, productIds));
    const catSlugs = new Map<string, string[]>();
    for (const c of cats) {
      const arr = catSlugs.get(c.productId) ?? [];
      arr.push(c.slug);
      catSlugs.set(c.productId, arr);
    }

    return rows.map((p) => {
      const tr = trByProduct.get(p.id);
      const name = tr?.name ?? p.name;
      const description = tr?.description ?? p.description;
      const priceRow = priceByProduct.has(p.id)
        ? [{ currency: ctx.currency, amountCents: priceByProduct.get(p.id)! }]
        : [];
      const price = pickPrice(p.basePriceCents, p.currency, priceRow, ctx);
      return {
        id: p.id,
        slug: p.slug,
        name,
        description: snippet(description),
        priceCents: price.priceCents,
        currency: price.currency,
        imageUrl: firstImage.get(p.id) ?? null,
        categorySlugs: catSlugs.get(p.id) ?? [],
        // Earn stays in default-currency terms (points config is COP-based).
        earn: earnFor(p.basePriceCents),
      };
    });
  }

  async productBySlug(
    orgId: string,
    slug: string,
    ctx: LocaleContext,
  ): Promise<ProductDetail | null> {
    const p = await this.db.query.product.findFirst({
      where: and(eq(product.organizationId, orgId), eq(product.slug, slug)),
      with: {
        images: { orderBy: asc(productImage.sortOrder) },
        options: {
          orderBy: asc(productOption.sortOrder),
          with: { values: { orderBy: asc(productOptionValue.sortOrder) } },
        },
        variants: {
          orderBy: asc(productVariant.sortOrder),
          with: { values: true },
        },
        modifierGroups: {
          orderBy: asc(modifierGroup.sortOrder),
          with: { options: { orderBy: asc(modifierOption.sortOrder) } },
        },
        categories: { with: { category: true } },
      },
    });
    if (!p) return null;

    const variantImages = (variantId: string) =>
      p.images.filter((img) => img.variantId === variantId).map((img) => img.url);

    // Localize name/description + resolve prices for the active currency.
    let tr: { name: string; description: string | null } | undefined;
    if (ctx.locale !== ctx.defaultLocale) {
      const rows = await this.db
        .select()
        .from(productTranslation)
        .where(
          and(
            eq(productTranslation.productId, p.id),
            eq(productTranslation.locale, ctx.locale),
          ),
        )
        .limit(1);
      if (rows[0]) tr = { name: rows[0].name, description: rows[0].description };
    }

    const variantIds = p.variants.map((v) => v.id);
    const optionIds = p.modifierGroups.flatMap((g) => g.options.map((o) => o.id));
    const [basePriceRows, variantPriceRows, optionPriceRows] = await Promise.all([
      ctx.currency === ctx.defaultCurrency
        ? Promise.resolve([])
        : this.db
            .select()
            .from(productPrice)
            .where(
              and(eq(productPrice.productId, p.id), eq(productPrice.currency, ctx.currency)),
            ),
      ctx.currency === ctx.defaultCurrency || variantIds.length === 0
        ? Promise.resolve([])
        : this.db
            .select()
            .from(productVariantPrice)
            .where(
              and(
                inArray(productVariantPrice.variantId, variantIds),
                eq(productVariantPrice.currency, ctx.currency),
              ),
            ),
      ctx.currency === ctx.defaultCurrency || optionIds.length === 0
        ? Promise.resolve([])
        : this.db
            .select()
            .from(modifierOptionPrice)
            .where(
              and(
                inArray(modifierOptionPrice.modifierOptionId, optionIds),
                eq(modifierOptionPrice.currency, ctx.currency),
              ),
            ),
    ]);
    const variantPriceById = new Map(variantPriceRows.map((r) => [r.variantId, r.amountCents]));
    const optionPriceById = new Map(
      optionPriceRows.map((r) => [r.modifierOptionId, r.amountCents]),
    );
    const basePrice = pickPrice(p.basePriceCents, p.currency, basePriceRows, ctx);
    const detailCurrency = basePrice.currency;
    const amountFor = (ownerCents: number, override: number | undefined) =>
      detailCurrency === p.currency ? ownerCents : (override ?? ownerCents);

    return {
      id: p.id,
      slug: p.slug,
      name: tr?.name ?? p.name,
      description: tr?.description ?? p.description,
      currency: detailCurrency,
      basePriceCents: basePrice.priceCents,
      earn: earnFor(p.basePriceCents),
      images: p.images.map((img) => ({
        url: img.url,
        alt: img.alt,
        variantId: img.variantId,
      })),
      options: p.options.map((o) => ({
        id: o.id,
        name: o.name,
        values: o.values.map((v) => ({ id: v.id, label: v.label })),
      })),
      variants: p.variants.map((v) => ({
        id: v.id,
        priceCents: amountFor(v.priceCents, variantPriceById.get(v.id)),
        isDefault: v.isDefault,
        optionValueIds: v.values.map((vv) => vv.optionValueId),
        earn: earnFor(v.priceCents),
        imageUrls: variantImages(v.id),
      })),
      modifierGroups: p.modifierGroups.map((g) => ({
        id: g.id,
        name: g.name,
        selectionType: g.selectionType as "single" | "multi",
        minSelect: g.minSelect,
        maxSelect: g.maxSelect,
        required: g.required,
        options: g.options.map((mo) => ({
          id: mo.id,
          name: mo.name,
          priceDeltaCents: amountFor(mo.priceDeltaCents, optionPriceById.get(mo.id)),
        })),
      })),
      categorySlugs: p.categories.map((pc) => pc.category.slug),
      seo: {
        title: p.seoTitle,
        description: p.seoDescription,
        ogImageUrl: p.ogImageUrl,
      },
    };
  }

  async sections(
    orgId: string,
    placement: string,
    ctx: LocaleContext,
  ): Promise<SectionView[]> {
    const placements =
      placement === "both" ? ["both"] : [placement, "both"];
    const rows = await this.db.query.section.findMany({
      where: and(
        eq(section.organizationId, orgId),
        inArray(section.placement, placements),
      ),
      orderBy: asc(section.sortOrder),
      with: {
        products: {
          orderBy: asc(sectionProduct.sortOrder),
        },
      },
    });

    const allProductIds = rows.flatMap((s) => s.products.map((sp) => sp.productId));
    const cards = await this.cardsByIds([...new Set(allProductIds)], ctx);
    const cardById = new Map(cards.map((c) => [c.id, c]));

    return rows.map((s) => ({
      id: s.id,
      slug: s.slug,
      name: s.name,
      kind: s.kind as "carousel" | "banner" | "featured",
      hasMore: s.products.length > SECTION_CARD_CAP,
      banner:
        s.kind === "banner"
          ? {
              title: s.bannerTitle,
              subtitle: s.bannerSubtitle,
              imageUrl: s.bannerImageUrl,
              href: s.bannerHref,
            }
          : null,
      products: s.products
        .map((sp) => cardById.get(sp.productId))
        .filter((c): c is MenuCard => Boolean(c))
        .slice(0, SECTION_CARD_CAP),
    }));
  }

  async categories(
    orgId: string,
    ctx: LocaleContext,
  ): Promise<{ slug: string; name: string }[]> {
    const rows = await this.db
      .select({ id: category.id, slug: category.slug, name: category.name })
      .from(category)
      .where(eq(category.organizationId, orgId))
      .orderBy(asc(category.sortOrder), asc(category.name));

    if (ctx.locale === ctx.defaultLocale || rows.length === 0) {
      return rows.map((r) => ({ slug: r.slug, name: r.name }));
    }
    const trs = await this.db
      .select()
      .from(categoryTranslation)
      .where(
        and(
          inArray(categoryTranslation.categoryId, rows.map((r) => r.id)),
          eq(categoryTranslation.locale, ctx.locale),
        ),
      );
    const nameById = new Map(trs.map((t) => [t.categoryId, t.name]));
    return rows.map((r) => ({ slug: r.slug, name: nameById.get(r.id) ?? r.name }));
  }

  async favoriteProductIds(orgId: string, customerId: string): Promise<string[]> {
    const rows = await this.db
      .select({ productId: productFavorite.productId })
      .from(productFavorite)
      .where(
        and(
          eq(productFavorite.organizationId, orgId),
          eq(productFavorite.customerId, customerId),
        ),
      );
    return rows.map((r) => r.productId);
  }

  async favoriteProducts(
    orgId: string,
    customerId: string,
    ctx: LocaleContext,
  ): Promise<MenuCard[]> {
    const ids = await this.favoriteProductIds(orgId, customerId);
    return this.cardsByIds(ids, ctx);
  }

  /** Toggle a favorite; returns the new state (true = now favorited). */
  async toggleFavorite(input: {
    orgId: string;
    customerId: string;
    productId: string;
  }): Promise<boolean> {
    const existing = await this.db
      .select({ id: productFavorite.id })
      .from(productFavorite)
      .where(
        and(
          eq(productFavorite.customerId, input.customerId),
          eq(productFavorite.productId, input.productId),
        ),
      )
      .limit(1);
    if (existing[0]) {
      await this.db
        .delete(productFavorite)
        .where(eq(productFavorite.id, existing[0].id));
      return false;
    }
    await this.db.insert(productFavorite).values({
      customerId: input.customerId,
      organizationId: input.orgId,
      productId: input.productId,
    });
    return true;
  }
}

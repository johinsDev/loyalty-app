import type { db as Db } from "@loyalty/db";
import {
  category,
  customer,
  modifierGroup,
  modifierOption,
  pointsAccount,
  product,
  productCategory,
  productOptionValue,
  productVariant,
  productVariantValue,
  promo,
  promoRedemption,
  promoTranslation,
  purchase,
  type PromoInsert,
  type PromoRow,
  type PromoTranslationRow,
} from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, getTableColumns, gt, gte, inArray, isNull, like, lt, lte, or, sql, type SQL } from "drizzle-orm";

import { buildOrderBy, pageCountOf, pageOffset, type ListResult } from "../_shared/list";
import type { LocaleContext } from "../_shared/localize";
import { slugify, slugSuffix } from "../_shared/slugify";
import { benefitSummary, type SummaryLocale } from "./format";
import type { ItemRef } from "./schemas";
import type { AdminListInput, PromoCard, PromoDetail, PublicListInput } from "./schemas";

/** Columns a wizard step / content patch may write. */
export type PromoPatch = Partial<
  Pick<
    PromoInsert,
    | "name" | "slug" | "shortDescription" | "longDescription" | "badgeLabel" | "icon"
    | "backgroundCss" | "mainImageUrl" | "type" | "rule" | "schedule" | "conditions"
    | "audienceType" | "tierKey" | "audienceCustomerIds" | "category" | "featured"
    | "sortOrder" | "startsAt" | "endsAt" | "seoTitle" | "seoDescription" | "ogImageUrl"
  >
>;

const summaryLocale = (ctx: LocaleContext): SummaryLocale =>
  ctx.locale === "en" ? "en" : "es";

function localizedText(
  row: PromoRow,
  tr: PromoTranslationRow | undefined,
  ctx: LocaleContext,
): { name: string; shortDescription: string | null; longDescription: string | null; badgeLabel: string | null } {
  if (ctx.locale === ctx.defaultLocale || !tr) {
    return {
      name: row.name ?? "",
      shortDescription: row.shortDescription,
      longDescription: row.longDescription,
      badgeLabel: row.badgeLabel,
    };
  }
  return {
    name: tr.name || (row.name ?? ""),
    shortDescription: tr.shortDescription ?? row.shortDescription,
    longDescription: tr.longDescription ?? row.longDescription,
    badgeLabel: tr.badgeLabel ?? row.badgeLabel,
  };
}

function toCard(
  row: PromoRow,
  tr: PromoTranslationRow | undefined,
  ctx: LocaleContext,
  names?: ReadonlyMap<string, string>,
): PromoCard {
  const loc = localizedText(row, tr, ctx);
  return {
    id: row.id,
    slug: row.slug ?? "",
    name: loc.name,
    shortDescription: loc.shortDescription,
    benefitSummary: benefitSummary(row.type, row.rule, summaryLocale(ctx), names),
    badgeLabel: loc.badgeLabel,
    icon: row.icon,
    backgroundCss: row.backgroundCss,
    mainImageUrl: row.mainImageUrl,
    category: row.category,
    featured: row.featured,
  };
}

export type AdminPromoRow = PromoRow & { uses: number };

/** Drizzle access for `promo`. Only layer that touches the db; org-scoped. */
export class PromoRepository {
  constructor(private readonly db: typeof Db) {}

  // ── Admin CRUD ────────────────────────────────────────────────────────────
  async createDraft(orgId: string, userId: string, preseed: PromoPatch = {}): Promise<PromoRow> {
    const rows = await this.db
      .insert(promo)
      .values({
        organizationId: orgId,
        createdByUserId: userId,
        status: "draft",
        slug: `borrador-${slugSuffix()}`,
        ...preseed,
      })
      .returning();
    return this.#first(rows, "insert");
  }

  async findById(orgId: string, id: string): Promise<PromoRow | null> {
    const rows = await this.db
      .select()
      .from(promo)
      .where(and(eq(promo.id, id), eq(promo.organizationId, orgId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async patch(orgId: string, id: string, patch: PromoPatch): Promise<PromoRow> {
    const rows = await this.db
      .update(promo)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(promo.id, id), eq(promo.organizationId, orgId)))
      .returning();
    return this.#first(rows, "patch");
  }

  async markPublished(orgId: string, id: string): Promise<PromoRow> {
    const now = new Date();
    const rows = await this.db
      .update(promo)
      .set({ status: "published", publishedAt: now, updatedAt: now })
      .where(and(eq(promo.id, id), eq(promo.organizationId, orgId)))
      .returning();
    return this.#first(rows, "publish");
  }

  async markArchived(orgId: string, id: string): Promise<PromoRow> {
    const rows = await this.db
      .update(promo)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(promo.id, id), eq(promo.organizationId, orgId)))
      .returning();
    return this.#first(rows, "archive");
  }

  async remove(orgId: string, id: string): Promise<void> {
    await this.db.delete(promo).where(and(eq(promo.id, id), eq(promo.organizationId, orgId)));
  }

  async redemptionCount(promoId: string): Promise<number> {
    const [row] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(promoRedemption)
      .where(eq(promoRedemption.promoId, promoId));
    return Number(row?.value ?? 0);
  }

  async adminList(orgId: string, input: AdminListInput, now = new Date()): Promise<ListResult<AdminPromoRow>> {
    const usesExpr = sql<number>`(select count(*) from ${promoRedemption} where ${promoRedemption.promoId} = ${promo.id})`;

    const conds: (SQL | undefined)[] = [eq(promo.organizationId, orgId)];
    if (input.q) conds.push(like(promo.name, `%${input.q}%`));
    if (input.status?.length) conds.push(inArray(promo.status, input.status));
    if (input.type?.length) conds.push(inArray(promo.type, input.type));
    if (input.audience?.length) conds.push(inArray(promo.audienceType, input.audience));
    if (input.startsFrom) conds.push(gte(promo.startsAt, input.startsFrom));
    if (input.startsTo) conds.push(lte(promo.startsAt, input.startsTo));
    if (input.vigency?.length) {
      const published = eq(promo.status, "published");
      const byKey: Record<string, SQL | undefined> = {
        active: and(
          published,
          or(isNull(promo.startsAt), lte(promo.startsAt, now)),
          or(isNull(promo.endsAt), gte(promo.endsAt, now)),
        ),
        scheduled: and(published, gt(promo.startsAt, now)),
        expired: and(published, lt(promo.endsAt, now)),
      };
      conds.push(or(...input.vigency.map((v) => byKey[v]).filter((c): c is SQL => Boolean(c))));
    }
    const where = and(...conds.filter((c): c is SQL => Boolean(c)));

    const orderBy = buildOrderBy(
      input.sort,
      {
        name: promo.name,
        createdAt: promo.createdAt,
        startsAt: promo.startsAt,
        uses: usesExpr,
      },
      [asc(promo.sortOrder), desc(promo.updatedAt)],
    );

    const rows = await this.db
      .select({ ...getTableColumns(promo), uses: usesExpr })
      .from(promo)
      .where(where)
      .orderBy(...orderBy)
      .limit(input.perPage)
      .offset(pageOffset(input.page, input.perPage));
    const totalRows = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(promo)
      .where(where);
    const total = Number(totalRows[0]?.value ?? 0);
    return {
      rows: rows.map((r) => ({ ...r, uses: Number(r.uses) })),
      total,
      pageCount: pageCountOf(total, input.perPage),
    };
  }

  async slugExists(orgId: string, slug: string, excludeId?: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: promo.id })
      .from(promo)
      .where(and(eq(promo.organizationId, orgId), eq(promo.slug, slug)))
      .limit(1);
    const hit = rows[0];
    return hit ? hit.id !== excludeId : false;
  }

  async uniqueSlug(orgId: string, desired: string, excludeId?: string): Promise<string> {
    const base = slugify(desired) || `promo-${slugSuffix()}`;
    let candidate = base;
    while (await this.slugExists(orgId, candidate, excludeId)) candidate = `${base}-${slugSuffix()}`;
    return candidate;
  }

  // ── Public reads (localized) ───────────────────────────────────────────────
  #publishedInWindow(orgId: string, now: Date) {
    return and(
      eq(promo.organizationId, orgId),
      eq(promo.status, "published"),
      or(isNull(promo.startsAt), lte(promo.startsAt, now)),
      or(isNull(promo.endsAt), gte(promo.endsAt, now)),
    );
  }

  async listHomePromos(orgId: string, ctx: LocaleContext, now = new Date()): Promise<PromoCard[]> {
    const rows = await this.db
      .select()
      .from(promo)
      .where(and(this.#publishedInWindow(orgId, now), eq(promo.featured, true)))
      .orderBy(asc(promo.sortOrder), asc(promo.id))
      .limit(12);
    return this.#withTranslations(rows, ctx);
  }

  async listPromos(
    orgId: string,
    ctx: LocaleContext,
    input: PublicListInput,
    now = new Date(),
  ): Promise<{ items: PromoCard[]; nextCursor: string | null }> {
    const conds = [this.#publishedInWindow(orgId, now)];
    if (input.category) conds.push(eq(promo.category, input.category));
    const offset = input.cursor ? Number(input.cursor) || 0 : 0;
    const rows = await this.db
      .select()
      .from(promo)
      .where(and(...conds))
      .orderBy(asc(promo.sortOrder), asc(promo.id))
      .limit(input.pageSize + 1)
      .offset(offset);
    const page = rows.slice(0, input.pageSize);
    const nextCursor = rows.length > input.pageSize ? String(offset + input.pageSize) : null;
    return { items: await this.#withTranslations(page, ctx), nextCursor };
  }

  async promoBySlug(orgId: string, slug: string, ctx: LocaleContext): Promise<PromoDetail | null> {
    const rows = await this.db
      .select()
      .from(promo)
      .where(
        and(eq(promo.organizationId, orgId), eq(promo.slug, slug), eq(promo.status, "published")),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const tr = (await this.#translationsFor([row.id], ctx)).get(row.id);
    const names = await this.refNames(collectRefs(row));
    const card = toCard(row, tr, ctx, names);
    return {
      ...card,
      longDescription: localizedText(row, tr, ctx).longDescription,
      type: row.type,
      seo: { title: row.seoTitle, description: row.seoDescription, ogImageUrl: row.ogImageUrl },
    };
  }

  /** Published promos (raw) for eligibility evaluation at checkout. */
  async publishedPromos(orgId: string, now = new Date()): Promise<PromoRow[]> {
    return this.db
      .select()
      .from(promo)
      .where(this.#publishedInWindow(orgId, now))
      .orderBy(asc(promo.sortOrder), asc(promo.id));
  }

  // ── Facts for eligibility ──────────────────────────────────────────────────
  async customerFacts(
    orgId: string,
    customerId: string,
  ): Promise<{ tierKey: string | null; purchaseCount: number; lastPurchaseAt: Date | null }> {
    const [acc] = await this.db
      .select({ tierKey: pointsAccount.currentTierKey })
      .from(pointsAccount)
      .where(
        and(eq(pointsAccount.organizationId, orgId), eq(pointsAccount.customerId, customerId)),
      )
      .limit(1);
    const [cnt] = await this.db
      .select({
        value: sql<number>`count(*)`,
        last: sql<number | null>`max(${purchase.createdAt})`,
      })
      .from(purchase)
      .where(and(eq(purchase.organizationId, orgId), eq(purchase.customerId, customerId)));
    const last = cnt?.last;
    return {
      tierKey: acc?.tierKey ?? null,
      purchaseCount: Number(cnt?.value ?? 0),
      lastPurchaseAt: last != null ? new Date(Number(last) * 1000) : null,
    };
  }

  async redemptionCounts(
    promoIds: string[],
    customerId: string,
  ): Promise<Map<string, { total: number; byCustomer: number }>> {
    const map = new Map<string, { total: number; byCustomer: number }>();
    if (promoIds.length === 0) return map;
    for (const id of promoIds) map.set(id, { total: 0, byCustomer: 0 });
    const totals = await this.db
      .select({ promoId: promoRedemption.promoId, n: sql<number>`count(*)` })
      .from(promoRedemption)
      .where(inArray(promoRedemption.promoId, promoIds))
      .groupBy(promoRedemption.promoId);
    const mine = await this.db
      .select({ promoId: promoRedemption.promoId, n: sql<number>`count(*)` })
      .from(promoRedemption)
      .where(
        and(
          inArray(promoRedemption.promoId, promoIds),
          eq(promoRedemption.customerId, customerId),
        ),
      )
      .groupBy(promoRedemption.promoId);
    for (const t of totals) map.get(t.promoId)!.total = Number(t.n);
    for (const m of mine) map.get(m.promoId)!.byCustomer = Number(m.n);
    return map;
  }

  /** category ids per product (to match category-scoped promos against a cart). */
  async productCategories(productIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (productIds.length === 0) return map;
    const rows = await this.db
      .select({ productId: productCategory.productId, categoryId: productCategory.categoryId })
      .from(productCategory)
      .where(inArray(productCategory.productId, productIds));
    for (const r of rows) {
      const arr = map.get(r.productId) ?? [];
      arr.push(r.categoryId);
      map.set(r.productId, arr);
    }
    return map;
  }

  /** price delta per modifier option (so the engine can discount modifiers). */
  async modifierOptionDeltas(ids: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (ids.length === 0) return map;
    const rows = await this.db
      .select({ id: modifierOption.id, delta: modifierOption.priceDeltaCents })
      .from(modifierOption)
      .where(inArray(modifierOption.id, ids));
    for (const r of rows) map.set(r.id, r.delta);
    return map;
  }

  /** Display names for rule refs, keyed by ref id. */
  async refNames(refs: ItemRef[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    const byKind = (kind: ItemRef["kind"]) =>
      refs.filter((r) => r.kind === kind).map((r) => r.id);
    const productIds = byKind("product");
    const categoryIds = byKind("category");
    const variantIds = byKind("variant");
    const modifierIds = byKind("modifierOption");
    if (productIds.length > 0) {
      const rows = await this.db
        .select({ id: product.id, name: product.name })
        .from(product)
        .where(inArray(product.id, productIds));
      for (const r of rows) map.set(r.id, r.name);
    }
    if (categoryIds.length > 0) {
      const rows = await this.db
        .select({ id: category.id, name: category.name })
        .from(category)
        .where(inArray(category.id, categoryIds));
      for (const r of rows) map.set(r.id, r.name);
    }
    if (variantIds.length > 0) {
      const rows = await this.db
        .select({
          variantId: productVariantValue.variantId,
          label: productOptionValue.label,
          productName: product.name,
        })
        .from(productVariantValue)
        .innerJoin(
          productOptionValue,
          eq(productVariantValue.optionValueId, productOptionValue.id),
        )
        .innerJoin(productVariant, eq(productVariantValue.variantId, productVariant.id))
        .innerJoin(product, eq(productVariant.productId, product.id))
        .where(inArray(productVariantValue.variantId, variantIds));
      const grouped = new Map<string, { productName: string; labels: string[] }>();
      for (const r of rows) {
        const g = grouped.get(r.variantId) ?? { productName: r.productName, labels: [] };
        g.labels.push(r.label);
        grouped.set(r.variantId, g);
      }
      for (const [id, g] of grouped) map.set(id, `${g.productName} · ${g.labels.join(" / ")}`);
    }
    if (modifierIds.length > 0) {
      const rows = await this.db
        .select({ id: modifierOption.id, name: modifierOption.name })
        .from(modifierOption)
        .where(inArray(modifierOption.id, modifierIds));
      for (const r of rows) map.set(r.id, r.name);
    }
    return map;
  }

  /** Variant + modifier choices for one product (the benefit-form ref picker). */
  async productRefOptions(productId: string): Promise<{
    variants: { id: string; label: string }[];
    modifierOptions: { id: string; label: string }[];
  }> {
    const variants = await this.db
      .select({ id: productVariant.id, sku: productVariant.sku })
      .from(productVariant)
      .where(eq(productVariant.productId, productId))
      .orderBy(asc(productVariant.sortOrder));
    const labelRows =
      variants.length === 0
        ? []
        : await this.db
            .select({
              variantId: productVariantValue.variantId,
              label: productOptionValue.label,
            })
            .from(productVariantValue)
            .innerJoin(
              productOptionValue,
              eq(productVariantValue.optionValueId, productOptionValue.id),
            )
            .where(
              inArray(
                productVariantValue.variantId,
                variants.map((v) => v.id),
              ),
            );
    const labelsByVariant = new Map<string, string[]>();
    for (const r of labelRows) {
      const arr = labelsByVariant.get(r.variantId) ?? [];
      arr.push(r.label);
      labelsByVariant.set(r.variantId, arr);
    }
    const mods = await this.db
      .select({
        id: modifierOption.id,
        name: modifierOption.name,
        groupName: modifierGroup.name,
      })
      .from(modifierOption)
      .innerJoin(modifierGroup, eq(modifierOption.groupId, modifierGroup.id))
      .where(eq(modifierGroup.productId, productId))
      .orderBy(asc(modifierGroup.sortOrder), asc(modifierOption.sortOrder));
    return {
      variants: variants.map((v) => ({
        id: v.id,
        label: labelsByVariant.get(v.id)?.join(" / ") ?? v.sku ?? v.id.slice(0, 8),
      })),
      modifierOptions: mods.map((m) => ({ id: m.id, label: `${m.groupName} · ${m.name}` })),
    };
  }

  /** Verify a customer belongs to the org (for the apply flow). */
  async customerInOrg(orgId: string, customerId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: customer.id })
      .from(customer)
      .where(and(eq(customer.id, customerId), eq(customer.organizationId, orgId)))
      .limit(1);
    return Boolean(rows[0]);
  }

  cardOf(row: PromoRow, ctx: LocaleContext): PromoCard {
    return toCard(row, undefined, ctx);
  }

  async #translationsFor(
    promoIds: string[],
    ctx: LocaleContext,
  ): Promise<Map<string, PromoTranslationRow>> {
    const map = new Map<string, PromoTranslationRow>();
    if (ctx.locale === ctx.defaultLocale || promoIds.length === 0) return map;
    const rows = await this.db
      .select()
      .from(promoTranslation)
      .where(
        and(
          inArray(promoTranslation.promoId, promoIds),
          eq(promoTranslation.locale, ctx.locale),
        ),
      );
    for (const r of rows) map.set(r.promoId, r);
    return map;
  }

  async #withTranslations(rows: PromoRow[], ctx: LocaleContext): Promise<PromoCard[]> {
    const tr = await this.#translationsFor(rows.map((r) => r.id), ctx);
    return rows.map((r) => toCard(r, tr.get(r.id), ctx));
  }

  #first(rows: PromoRow[], op: string): PromoRow {
    const row = rows[0];
    if (!row) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `promo ${op} returned no row` });
    }
    return row;
  }
}

/** Every catalog ref a promo's rule mentions (for name resolution). */
export function collectRefs(row: PromoRow): ItemRef[] {
  const rule = row.rule;
  if (!rule) return [];
  const reqs = [...rule.buy.requirements, ...(rule.get?.requirements ?? [])];
  return reqs.flatMap((r) => r.refs);
}

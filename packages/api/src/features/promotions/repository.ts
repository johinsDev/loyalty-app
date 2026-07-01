import type { db as Db } from "@loyalty/db";
import {
  customer,
  pointsAccount,
  productCategory,
  promo,
  promoRedemption,
  promoTranslation,
  purchase,
  type PromoInsert,
  type PromoRow,
  type PromoTranslationRow,
} from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, isNull, like, lte, or, sql } from "drizzle-orm";

import type { LocaleContext } from "../_shared/localize";
import { slugify, slugSuffix } from "../_shared/slugify";
import type { ListInput, PromoCard, PromoDetail, PublicListInput } from "./schemas";

/** Columns an admin edit may write. */
export type PromoPatch = Partial<
  Pick<
    PromoInsert,
    | "name" | "slug" | "shortDescription" | "longDescription" | "badgeLabel" | "icon"
    | "backgroundCss" | "mainImageUrl" | "type" | "benefit" | "scopeKind" | "scope"
    | "conditions" | "audienceType" | "tierKey" | "audienceCustomerIds" | "stackable"
    | "category" | "featured" | "startsAt" | "endsAt" | "seoTitle" | "seoDescription"
    | "ogImageUrl"
  >
>;

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

function toCard(row: PromoRow, tr: PromoTranslationRow | undefined, ctx: LocaleContext): PromoCard {
  const loc = localizedText(row, tr, ctx);
  return {
    id: row.id,
    slug: row.slug ?? "",
    name: loc.name,
    shortDescription: loc.shortDescription,
    badgeLabel: loc.badgeLabel,
    icon: row.icon,
    backgroundCss: row.backgroundCss,
    mainImageUrl: row.mainImageUrl,
    category: row.category,
    featured: row.featured,
  };
}

export interface AdminListResult {
  rows: PromoRow[];
  total: number;
}

/** Drizzle access for `promo`. Only layer that touches the db; org-scoped. */
export class PromoRepository {
  constructor(private readonly db: typeof Db) {}

  // ── Admin CRUD ────────────────────────────────────────────────────────────
  async createDraft(orgId: string, userId: string): Promise<PromoRow> {
    const rows = await this.db
      .insert(promo)
      .values({
        organizationId: orgId,
        createdByUserId: userId,
        status: "draft",
        slug: `borrador-${slugSuffix()}`,
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

  async remove(orgId: string, id: string): Promise<void> {
    await this.db.delete(promo).where(and(eq(promo.id, id), eq(promo.organizationId, orgId)));
  }

  async list(orgId: string, input: ListInput): Promise<AdminListResult> {
    const offset = (input.page - 1) * input.pageSize;
    const conds = [eq(promo.organizationId, orgId)];
    if (input.status) conds.push(eq(promo.status, input.status));
    if (input.search) conds.push(like(promo.name, `%${input.search}%`));
    const where = and(...conds);
    const rows = (await this.db
      .select()
      .from(promo)
      .where(where)
      .orderBy(asc(promo.sortOrder), desc(promo.updatedAt))
      .limit(input.pageSize)
      .offset(offset)) as PromoRow[];
    const totalRows = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(promo)
      .where(where);
    return { rows, total: totalRows[0]?.value ?? 0 };
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
    const card = toCard(row, tr, ctx);
    return {
      ...card,
      longDescription: localizedText(row, tr, ctx).longDescription,
      type: row.type,
      stackable: row.stackable,
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
  ): Promise<{ tierKey: string | null; purchaseCount: number }> {
    const [acc] = await this.db
      .select({ tierKey: pointsAccount.currentTierKey })
      .from(pointsAccount)
      .where(
        and(eq(pointsAccount.organizationId, orgId), eq(pointsAccount.customerId, customerId)),
      )
      .limit(1);
    const [cnt] = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(purchase)
      .where(and(eq(purchase.organizationId, orgId), eq(purchase.customerId, customerId)));
    return { tierKey: acc?.tierKey ?? null, purchaseCount: cnt?.value ?? 0 };
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

import type { db as Db } from "@loyalty/db";
import {
  banner,
  bannerDailyStat,
  bannerTranslation,
  type BannerInsert,
  type BannerRow,
  type BannerTranslationRow,
} from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, isNull, like, lte, or, sql } from "drizzle-orm";

import { type ListResult, pageCountOf, pageOffset } from "../_shared/list";
import type { LocaleContext } from "../_shared/localize";
import { slugify, slugSuffix } from "../_shared/slugify";
import { availableAtStore } from "../_shared/store-availability";
import type {
  BannerAnalytics,
  BannerCard,
  BannerDetail,
  BannerDisplayState,
  BannerListItem,
  BannersListInput,
  BannerStatPoint,
  ListInput,
  StaffBannerItem,
} from "./schemas";

/** Localized text for a banner: per-field override from the translation row,
 *  else the default-locale base columns. */
function localized(
  row: BannerRow,
  tr: BannerTranslationRow | undefined,
  ctx: LocaleContext,
): { name: string; shortDescription: string | null; longDescription: string | null } {
  if (ctx.locale === ctx.defaultLocale || !tr) {
    return {
      name: row.name,
      shortDescription: row.shortDescription,
      longDescription: row.longDescription,
    };
  }
  return {
    name: tr.name || row.name,
    shortDescription: tr.shortDescription ?? row.shortDescription,
    longDescription: tr.longDescription ?? row.longDescription,
  };
}

/** Slice of a banner a wizard step may write (excludes identity + lifecycle). */
export type BannerPatch = Partial<
  Pick<
    BannerInsert,
    | "name"
    | "slug"
    | "shortDescription"
    | "longDescription"
    | "backgroundCss"
    | "mainImageUrl"
    | "mainImageBlur"
    | "ctaLabel"
    | "ctaHref"
    | "ctaKind"
    | "displayFrom"
    | "displayUntil"
    | "storeIds"
    | "seoTitle"
    | "seoDescription"
    | "ogImageUrl"
  >
>;

export interface AdminListItem {
  banner: BannerRow;
  displayState: BannerDisplayState;
}
export interface AdminListResult {
  rows: AdminListItem[];
  total: number;
}

function toCard(row: BannerRow, tr: BannerTranslationRow | undefined, ctx: LocaleContext): BannerCard {
  const loc = localized(row, tr, ctx);
  return {
    id: row.id,
    slug: row.slug,
    name: loc.name,
    shortDescription: loc.shortDescription,
    backgroundCss: row.backgroundCss,
    mainImageUrl: row.mainImageUrl,
    mainImageBlur: row.mainImageBlur,
    cta: row.ctaHref
      ? {
          label: row.ctaLabel ?? "",
          href: row.ctaHref,
          kind: (row.ctaKind as "internal" | "external") ?? "external",
        }
      : null,
  };
}

function toDetail(row: BannerRow, tr: BannerTranslationRow | undefined, ctx: LocaleContext): BannerDetail {
  const loc = localized(row, tr, ctx);
  return {
    ...toCard(row, tr, ctx),
    longDescription: loc.longDescription,
    seo: {
      title: row.seoTitle,
      description: row.seoDescription,
      ogImageUrl: row.ogImageUrl,
    },
  };
}

/** Derive the admin display state from status + window (never stored). */
export function displayState(row: BannerRow, now = new Date()): BannerDisplayState {
  if (row.status !== "published") return "draft";
  if (row.displayUntil && row.displayUntil < now) return "expired";
  if (row.displayFrom && row.displayFrom > now) return "scheduled";
  return "active";
}

/**
 * Drizzle access for `banner`. Only layer that touches the db; every read/write
 * is org-scoped. Public reads return mapped `BannerCard`/`BannerDetail`; admin
 * CRUD returns rows for the wizard.
 */
export class BannersRepository {
  constructor(private readonly db: typeof Db) {}

  // ── Public reads ────────────────────────────────────────────────────────
  async listHomeBanners(
    orgId: string,
    ctx: LocaleContext,
    storeId?: string,
    now = new Date(),
  ): Promise<BannerCard[]> {
    const rows = await this.db
      .select()
      .from(banner)
      .where(
        and(
          eq(banner.organizationId, orgId),
          eq(banner.status, "published"),
          or(isNull(banner.displayFrom), lte(banner.displayFrom, now)),
          or(isNull(banner.displayUntil), gte(banner.displayUntil, now)),
          storeId ? availableAtStore(banner.storeIds, storeId) : undefined,
        ),
      )
      .orderBy(asc(banner.sortOrder), asc(banner.id));
    const trByBanner = await this.#translations(rows.map((r) => r.id), ctx);
    return rows.map((r) => toCard(r, trByBanner.get(r.id), ctx));
  }

  /** Cashier catalog: every published banner with its store scope + display
   *  state (active/scheduled/expired) so the cashier can confirm what's live. */
  async staffCatalog(
    orgId: string,
    ctx: LocaleContext,
    now = new Date(),
  ): Promise<StaffBannerItem[]> {
    const rows = await this.db
      .select()
      .from(banner)
      .where(and(eq(banner.organizationId, orgId), eq(banner.status, "published")))
      .orderBy(asc(banner.sortOrder), asc(banner.id));
    const trByBanner = await this.#translations(rows.map((r) => r.id), ctx);
    return rows.map((r) => {
      const card = toCard(r, trByBanner.get(r.id), ctx);
      return {
        id: r.id,
        name: card.name,
        shortDescription: card.shortDescription,
        mainImageUrl: r.mainImageUrl,
        storeIds: r.storeIds,
        displayState: displayState(r, now),
      };
    });
  }

  async bannerBySlug(
    orgId: string,
    slug: string,
    ctx: LocaleContext,
  ): Promise<BannerDetail | null> {
    const rows = await this.db
      .select()
      .from(banner)
      .where(
        and(
          eq(banner.organizationId, orgId),
          eq(banner.slug, slug),
          eq(banner.status, "published"),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    const trByBanner = await this.#translations([row.id], ctx);
    return toDetail(row, trByBanner.get(row.id), ctx);
  }

  /** Batch-load translation rows for the active (non-default) locale. */
  async #translations(
    bannerIds: string[],
    ctx: LocaleContext,
  ): Promise<Map<string, BannerTranslationRow>> {
    const map = new Map<string, BannerTranslationRow>();
    if (ctx.locale === ctx.defaultLocale || bannerIds.length === 0) return map;
    const rows = await this.db
      .select()
      .from(bannerTranslation)
      .where(
        and(
          inArray(bannerTranslation.bannerId, bannerIds),
          eq(bannerTranslation.locale, ctx.locale),
        ),
      );
    for (const r of rows) map.set(r.bannerId, r);
    return map;
  }

  // ── Admin CRUD ──────────────────────────────────────────────────────────
  async createDraft(orgId: string): Promise<BannerRow> {
    const sort = await this.nextSortOrder(orgId);
    const rows = await this.db
      .insert(banner)
      .values({
        organizationId: orgId,
        name: "Borrador",
        slug: `borrador-${slugSuffix()}`,
        status: "draft",
        sortOrder: sort,
      })
      .returning();
    return this.#first(rows, "insert");
  }

  async findById(orgId: string, id: string): Promise<BannerRow | null> {
    const rows = await this.db
      .select()
      .from(banner)
      .where(and(eq(banner.id, id), eq(banner.organizationId, orgId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async patch(orgId: string, id: string, patch: BannerPatch): Promise<BannerRow> {
    const rows = await this.db
      .update(banner)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(banner.id, id), eq(banner.organizationId, orgId)))
      .returning();
    return this.#first(rows, "patch");
  }

  async markPublished(orgId: string, id: string): Promise<BannerRow> {
    const rows = await this.db
      .update(banner)
      .set({ status: "published", updatedAt: new Date() })
      .where(and(eq(banner.id, id), eq(banner.organizationId, orgId)))
      .returning();
    return this.#first(rows, "publish");
  }

  async remove(orgId: string, id: string): Promise<void> {
    await this.db
      .delete(banner)
      .where(and(eq(banner.id, id), eq(banner.organizationId, orgId)));
  }

  async list(orgId: string, input: ListInput): Promise<AdminListResult> {
    const offset = (input.page - 1) * input.pageSize;
    const conds = [eq(banner.organizationId, orgId)];
    if (input.status) conds.push(eq(banner.status, input.status));
    if (input.search) conds.push(like(banner.name, `%${input.search}%`));
    const where = and(...conds);

    const rows = (await this.db
      .select()
      .from(banner)
      .where(where)
      .orderBy(asc(banner.sortOrder), desc(banner.updatedAt))
      .limit(input.pageSize)
      .offset(offset)) as BannerRow[];

    const totalRows = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(banner)
      .where(where);

    return {
      rows: rows.map((r) => ({
        banner: r,
        displayState: displayState(r),
      })),
      total: totalRows[0]?.value ?? 0,
    };
  }

  async reorder(orgId: string, ids: string[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await this.db
        .update(banner)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(and(eq(banner.id, ids[i]!), eq(banner.organizationId, orgId)));
    }
  }

  async slugExists(orgId: string, slug: string, excludeId?: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: banner.id })
      .from(banner)
      .where(and(eq(banner.organizationId, orgId), eq(banner.slug, slug)))
      .limit(1);
    const hit = rows[0];
    return hit ? hit.id !== excludeId : false;
  }

  /** A unique, human slug derived from `name`, suffixing on collision. */
  async uniqueSlug(orgId: string, desired: string, excludeId?: string): Promise<string> {
    const base = slugify(desired) || `banner-${slugSuffix()}`;
    let candidate = base;
    while (await this.slugExists(orgId, candidate, excludeId)) {
      candidate = `${base}-${slugSuffix()}`;
    }
    return candidate;
  }

  private async nextSortOrder(orgId: string): Promise<number> {
    const rows = await this.db
      .select({ max: sql<number>`coalesce(max(${banner.sortOrder}), -1)` })
      .from(banner)
      .where(eq(banner.organizationId, orgId));
    return (rows[0]?.max ?? -1) + 1;
  }

  // ── Admin data-table list ─────────────────────────────────────────────────
  /** Paginated/filtered/sorted list for the admin data-table. Banner counts per
   *  org are small, so derived-state filter + sort + pagination run in memory. */
  async adminList(
    orgId: string,
    input: BannersListInput,
  ): Promise<ListResult<BannerListItem>> {
    const conds = [eq(banner.organizationId, orgId)];
    if (input.q) {
      const term = `%${input.q}%`;
      conds.push(or(like(banner.name, term), like(banner.slug, term))!);
    }
    if (input.createdFrom) conds.push(gte(banner.createdAt, input.createdFrom));
    if (input.createdTo) conds.push(lte(banner.createdAt, input.createdTo));
    if (input.storeId) conds.push(availableAtStore(banner.storeIds, input.storeId));

    const all = await this.db.select().from(banner).where(and(...conds));
    const now = new Date();

    let items: BannerListItem[] = all.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      status: r.status,
      displayState: displayState(r, now),
      backgroundCss: r.backgroundCss,
      mainImageUrl: r.mainImageUrl,
      displayFrom: r.displayFrom,
      displayUntil: r.displayUntil,
      storeIds: r.storeIds ?? null,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
    }));

    if (input.state?.length) {
      const set = new Set(input.state);
      items = items.filter((i) => set.has(i.displayState));
    }

    const primary = input.sort[0];
    items.sort((a, b) => {
      const dir = primary?.desc ? -1 : 1;
      if (primary?.id === "name") return a.name.localeCompare(b.name) * dir;
      if (primary?.id === "createdAt")
        return (a.createdAt.getTime() - b.createdAt.getTime()) * dir;
      // default: home order (sortOrder asc) then newest
      return a.sortOrder - b.sortOrder || b.createdAt.getTime() - a.createdAt.getTime();
    });

    const total = items.length;
    const start = pageOffset(input.page, input.perPage);
    return {
      rows: items.slice(start, start + input.perPage),
      total,
      pageCount: pageCountOf(total, input.perPage),
    };
  }

  async listByIds(orgId: string, ids: string[]): Promise<BannerListItem[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(banner)
      .where(and(eq(banner.organizationId, orgId), inArray(banner.id, ids)));
    const now = new Date();
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      status: r.status,
      displayState: displayState(r, now),
      backgroundCss: r.backgroundCss,
      mainImageUrl: r.mainImageUrl,
      displayFrom: r.displayFrom,
      displayUntil: r.displayUntil,
      storeIds: r.storeIds ?? null,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt,
    }));
  }

  async bulkRemove(orgId: string, ids: string[]): Promise<void> {
    await this.db
      .delete(banner)
      .where(and(eq(banner.organizationId, orgId), inArray(banner.id, ids)));
  }

  // ── CTR stats ─────────────────────────────────────────────────────────────
  async recordStat(
    orgId: string,
    bannerId: string,
    day: string,
    field: "impressions" | "clicks",
  ): Promise<void> {
    await this.db
      .insert(bannerDailyStat)
      .values({
        organizationId: orgId,
        bannerId,
        day,
        impressions: field === "impressions" ? 1 : 0,
        clicks: field === "clicks" ? 1 : 0,
      })
      .onConflictDoUpdate({
        target: [bannerDailyStat.bannerId, bannerDailyStat.day],
        set: { [field]: sql`${bannerDailyStat[field]} + 1` },
      });
  }

  async dailyStats(
    orgId: string,
    bannerId: string,
    from?: string,
    to?: string,
  ): Promise<BannerStatPoint[]> {
    const conds = [
      eq(bannerDailyStat.organizationId, orgId),
      eq(bannerDailyStat.bannerId, bannerId),
    ];
    if (from) conds.push(gte(bannerDailyStat.day, from));
    if (to) conds.push(lte(bannerDailyStat.day, to));
    const rows = await this.db
      .select({
        day: bannerDailyStat.day,
        impressions: bannerDailyStat.impressions,
        clicks: bannerDailyStat.clicks,
      })
      .from(bannerDailyStat)
      .where(and(...conds))
      .orderBy(asc(bannerDailyStat.day));
    return rows.map((r) => ({
      day: r.day,
      impressions: Number(r.impressions),
      clicks: Number(r.clicks),
    }));
  }

  /** Org-level CTR analytics: totals, daily series, and top banners by CTR. */
  async orgAnalytics(orgId: string, from?: string): Promise<BannerAnalytics> {
    const conds = [eq(bannerDailyStat.organizationId, orgId)];
    if (from) conds.push(gte(bannerDailyStat.day, from));

    const perBanner = await this.db
      .select({
        bannerId: bannerDailyStat.bannerId,
        name: banner.name,
        slug: banner.slug,
        impressions: sql<number>`coalesce(sum(${bannerDailyStat.impressions}), 0)`,
        clicks: sql<number>`coalesce(sum(${bannerDailyStat.clicks}), 0)`,
      })
      .from(bannerDailyStat)
      .innerJoin(banner, eq(banner.id, bannerDailyStat.bannerId))
      .where(and(...conds))
      .groupBy(bannerDailyStat.bannerId);

    const byDay = await this.db
      .select({
        day: bannerDailyStat.day,
        impressions: sql<number>`coalesce(sum(${bannerDailyStat.impressions}), 0)`,
        clicks: sql<number>`coalesce(sum(${bannerDailyStat.clicks}), 0)`,
      })
      .from(bannerDailyStat)
      .where(and(...conds))
      .groupBy(bannerDailyStat.day)
      .orderBy(asc(bannerDailyStat.day));

    const top = perBanner
      .map((r) => {
        const impressions = Number(r.impressions);
        const clicks = Number(r.clicks);
        return {
          id: r.bannerId,
          name: r.name,
          slug: r.slug,
          impressions,
          clicks,
          ctr: impressions > 0 ? clicks / impressions : 0,
        };
      })
      .sort((a, b) => b.impressions - a.impressions);

    const impressions = top.reduce((s, r) => s + r.impressions, 0);
    const clicks = top.reduce((s, r) => s + r.clicks, 0);
    return {
      totals: {
        impressions,
        clicks,
        ctr: impressions > 0 ? clicks / impressions : 0,
        banners: top.length,
      },
      top: top.slice(0, 10),
      series: byDay.map((r) => ({
        day: r.day,
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
      })),
    };
  }

  #first(rows: BannerRow[], op: string): BannerRow {
    const row = rows[0];
    if (!row) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `banner ${op} returned no row`,
      });
    }
    return row;
  }
}

import type { db as Db } from "@loyalty/db";
import {
  banner,
  bannerNotification,
  bannerTranslation,
  customer,
  pointsAccount,
  type BannerInsert,
  type BannerNotificationInsert,
  type BannerNotificationRow,
  type BannerRow,
  type BannerTranslationRow,
} from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, inArray, isNull, like, lte, or, sql } from "drizzle-orm";

import type { LocaleContext } from "../_shared/localize";
import { slugify, slugSuffix } from "../_shared/slugify";
import type {
  BannerCard,
  BannerDetail,
  BannerDisplayState,
  ListInput,
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
    | "seoTitle"
    | "seoDescription"
    | "ogImageUrl"
  >
>;

export interface AdminListItem {
  banner: BannerRow;
  displayState: BannerDisplayState;
  notificationCount: number;
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
 * Drizzle access for `banner` + `banner_notification`. Only layer that touches
 * the db; every read/write is org-scoped. Public reads return mapped
 * `BannerCard`/`BannerDetail`; admin CRUD returns rows for the wizard.
 */
export class BannersRepository {
  constructor(private readonly db: typeof Db) {}

  // ── Public reads ────────────────────────────────────────────────────────
  async listHomeBanners(
    orgId: string,
    ctx: LocaleContext,
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
        ),
      )
      .orderBy(asc(banner.sortOrder), asc(banner.id));
    const trByBanner = await this.#translations(rows.map((r) => r.id), ctx);
    return rows.map((r) => toCard(r, trByBanner.get(r.id), ctx));
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

    const counts = await this.db
      .select({
        bannerId: bannerNotification.bannerId,
        n: sql<number>`count(*)`,
      })
      .from(bannerNotification)
      .where(
        rows.length
          ? or(...rows.map((r) => eq(bannerNotification.bannerId, r.id)))
          : sql`0 = 1`,
      )
      .groupBy(bannerNotification.bannerId);
    const countByBanner = new Map(counts.map((c) => [c.bannerId, Number(c.n)]));

    const totalRows = await this.db
      .select({ value: sql<number>`count(*)` })
      .from(banner)
      .where(where);

    return {
      rows: rows.map((r) => ({
        banner: r,
        displayState: displayState(r),
        notificationCount: countByBanner.get(r.id) ?? 0,
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

  // ── Notifications ─────────────────────────────────────────────────────────
  async createNotification(values: BannerNotificationInsert): Promise<BannerNotificationRow> {
    const rows = await this.db.insert(bannerNotification).values(values).returning();
    return this.#firstN(rows);
  }

  async listNotifications(bannerId: string): Promise<BannerNotificationRow[]> {
    return this.db
      .select()
      .from(bannerNotification)
      .where(eq(bannerNotification.bannerId, bannerId))
      .orderBy(desc(bannerNotification.createdAt));
  }

  async getNotification(id: string): Promise<BannerNotificationRow | null> {
    const rows = await this.db
      .select()
      .from(bannerNotification)
      .where(eq(bannerNotification.id, id))
      .limit(1);
    return rows[0] ?? null;
  }

  async setNotificationRun(id: string, runId: string | null): Promise<void> {
    await this.db
      .update(bannerNotification)
      .set({ runId, updatedAt: new Date() })
      .where(eq(bannerNotification.id, id));
  }

  async setNotificationStatus(id: string, status: string): Promise<void> {
    await this.db
      .update(bannerNotification)
      .set({ status, updatedAt: new Date() })
      .where(eq(bannerNotification.id, id));
  }

  // ── Audience resolution ───────────────────────────────────────────────────
  async listActiveCustomerIds(orgId: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: customer.id })
      .from(customer)
      .where(eq(customer.organizationId, orgId));
    return rows.map((r) => r.id);
  }

  async listCustomerIdsByTier(orgId: string, tierKey: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: pointsAccount.customerId })
      .from(pointsAccount)
      .where(
        and(
          eq(pointsAccount.organizationId, orgId),
          eq(pointsAccount.currentTierKey, tierKey),
        ),
      );
    return rows.map((r) => r.id);
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

  #firstN(rows: BannerNotificationRow[]): BannerNotificationRow {
    const row = rows[0];
    if (!row) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "banner_notification insert returned no row",
      });
    }
    return row;
  }
}

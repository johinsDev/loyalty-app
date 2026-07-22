import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { organization } from "./auth";

// Banners: first-class promotional / announcement cards (not necessarily a promo
// — also new hours, new drinks, a new store). Multi-tenant (org-scoped). Admin
// authors them (name, slug, background image|gradient|pattern, main image, short
// + long tiptap description, optional CTA, display window). The customer sees a
// home rail; tapping a banner with a CTA goes straight to the target, otherwise
// it opens the detail (intercepted modal + RSC page for SEO). v1 is auth-gated
// but written public-ready.

export const banner = sqliteTable(
  "banner",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull().default("draft"), // draft | published
    sortOrder: integer("sort_order").notNull().default(0),
    // JSON array of store ids this banner shows at (null/empty = every store).
    storeIds: text("store_ids", { mode: "json" }).$type<string[] | null>(),

    // Content
    shortDescription: text("short_description"),
    // Rich text (tiptap HTML).
    longDescription: text("long_description"),

    // Visual — two layers. `backgroundCss` is whatever BackgroundPicker emits
    // (solid color | gradient | `url(...)` image | decorative pattern).
    backgroundCss: text("background_css"),
    mainImageUrl: text("main_image_url"),
    mainImageBlur: text("main_image_blur"),

    // Call to action — when present, the home tap goes straight here (no detail).
    ctaLabel: text("cta_label"),
    ctaHref: text("cta_href"),
    ctaKind: text("cta_kind"), // internal | external

    // Display window (home visibility); both nullable = always within range.
    displayFrom: integer("display_from", { mode: "timestamp" }),
    displayUntil: integer("display_until", { mode: "timestamp" }),

    // SEO (detail page).
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ogImageUrl: text("og_image_url"),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    slugPerOrg: uniqueIndex("banner_slug_per_org_uq").on(t.organizationId, t.slug),
    byOrgSort: index("banner_org_sort_idx").on(
      t.organizationId,
      t.status,
      t.sortOrder,
      t.id,
    ),
  }),
);

export const bannerRelations = relations(banner, ({ one }) => ({
  organization: one(organization, {
    fields: [banner.organizationId],
    references: [organization.id],
  }),
}));

// Per-banner daily impression/click counters (CTR analytics). The customer web
// app increments today's bucket on view (once per session per banner) + on CTA
// click; the admin reads these for per-banner CTR + the Analytics panel. Kept as
// daily aggregates (not per-event) so home-rail impressions don't bloat the table.
export const bannerDailyStat = sqliteTable(
  "banner_daily_stat",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    bannerId: text("banner_id")
      .notNull()
      .references(() => banner.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // local YYYY-MM-DD (org timezone)
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
  },
  (t) => ({
    perBannerDay: uniqueIndex("banner_daily_stat_banner_day_uq").on(t.bannerId, t.day),
    byOrgDay: index("banner_daily_stat_org_day_idx").on(t.organizationId, t.day),
  }),
);

// Per-locale overrides (base columns = default-locale content). Slug canonical.
export const bannerTranslation = sqliteTable(
  "banner_translation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    bannerId: text("banner_id")
      .notNull()
      .references(() => banner.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    shortDescription: text("short_description"),
    longDescription: text("long_description"),
  },
  (t) => ({
    uq: uniqueIndex("banner_translation_uq").on(t.bannerId, t.locale),
  }),
);

// ---- Row types -------------------------------------------------------------

export type BannerTranslationRow = typeof bannerTranslation.$inferSelect;

export type BannerRow = typeof banner.$inferSelect;
export type BannerInsert = typeof banner.$inferInsert;
export type BannerDailyStatRow = typeof bannerDailyStat.$inferSelect;

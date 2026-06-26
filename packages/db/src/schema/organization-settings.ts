import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { organization } from "./auth";

/** Brand social links (only filled keys are shown in the customer app). */
export type SocialLinks = {
  instagram?: string;
  whatsapp?: string;
  facebook?: string;
  tiktok?: string;
  x?: string;
  website?: string;
};

// Per-org localization + branding config (1:1 with the org). Started as the
// locale/currency config and is now the home for the rest of the admin Settings:
// brand (description, color, social, terms), SEO, and the loyalty wallet scope.
// `name` + `logo` stay on the `organization` row; everything else lives here.
export const organizationSettings = sqliteTable("organization_settings", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  organizationId: text("organization_id")
    .notNull()
    .unique()
    .references(() => organization.id, { onDelete: "cascade" }),
  defaultLocale: text("default_locale").notNull().default("es"),
  enabledLocales: text("enabled_locales", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => ["es"]),
  defaultCurrency: text("default_currency").notNull().default("COP"),
  enabledCurrencies: text("enabled_currencies", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .$defaultFn(() => ["COP"]),

  // ── Branding (drives the customer app theme + store profile) ──────────────
  description: text("description"),
  brandColor: text("brand_color"), // hex, e.g. "#1BAD9D" → re-themes the app
  socialLinks: text("social_links", { mode: "json" }).$type<SocialLinks>(),
  termsPdfUrl: text("terms_pdf_url"), // uploaded T&C (R2)

  // Wallet scope across stores: "org" = shared (today), "store" = per-branch
  // (enforcement deferred — see docs/store-config.md backlog).
  loyaltyScope: text("loyalty_scope").notNull().default("org"),

  // ── SEO (consumed by the apps' root metadata) ─────────────────────────────
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  seoKeywords: text("seo_keywords", { mode: "json" }).$type<string[]>(),
  ogImageUrl: text("og_image_url"),

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const organizationSettingsRelations = relations(
  organizationSettings,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationSettings.organizationId],
      references: [organization.id],
    }),
  }),
);

export type OrganizationSettingsRow = typeof organizationSettings.$inferSelect;
export type OrganizationSettingsInsert = typeof organizationSettings.$inferInsert;

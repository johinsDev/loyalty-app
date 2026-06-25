import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { organization } from "./auth";

// Per-org localization config: the default locale + currency and which extra
// ones the store enables. When more than one is enabled, the customer app shows
// the locale/currency switchers; missing translations/prices fall back to the
// default. v1 supports es/en + COP/USD only (validated in the service). This is
// also the future home for the rest of the admin Settings.
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

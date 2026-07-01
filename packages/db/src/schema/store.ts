import type { StoreAddress } from "@loyalty/address";
import { relations } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { organization, user } from "./auth";
import type { SocialLinks } from "./organization-settings";

/** Weekly opening hours: 0 (Sun) – 6 (Sat). `closed` overrides open/close. */
export type StoreHours = Record<
  number,
  { open: string; close: string; closed: boolean } | undefined
>;

/**
 * `store` — a physical branch of an organization (multi-location). The brand
 * (name/logo/colors/social/T&C/SEO) lives on the org + `organization_settings`;
 * each store carries its own location + hours. The customer app lists the
 * published ones and shows the primary by default (with a switcher when >1).
 * `mapStaticUrl` is a Static Maps screenshot generated once on save → R2.
 */
export const store = sqliteTable(
  "store",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    name: text("name").notNull(), // display name, e.g. "T4 Colina"
    slug: text("slug"),
    address: text("address"), // denormalized single-line form (customer display)
    addressParts: text("address_parts", { mode: "json" }).$type<StoreAddress>(), // structured
    lat: real("lat"),
    lng: real("lng"),
    placeId: text("place_id"), // Google Places id (from autocomplete)
    // Branding — null = inherit the org's value (org.logo / org_settings.socialLinks).
    logo: text("logo"),
    socialLinks: text("social_links", { mode: "json" }).$type<SocialLinks>(),
    phone: text("phone"), // null = inherit org_settings.phone
    hours: text("hours", { mode: "json" }).$type<StoreHours>(), // null = inherit org_settings.defaultHours
    timezone: text("timezone").notNull().default("America/Bogota"),
    mapStaticUrl: text("map_static_url"), // R2 Static Maps screenshot

    // Wizard lifecycle (entity-as-draft). Column default is "published" so the
    // ADD-COLUMN migration leaves existing stores live; the wizard's `create`
    // sets "draft" explicitly. The customer only sees published + visible +
    // non-deleted stores.
    status: text("status").notNull().default("published"),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    isPublished: integer("is_published", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: integer("deleted_at", { mode: "timestamp" }), // soft delete

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    byOrgPrimary: index("store_org_primary_idx").on(t.organizationId, t.isPrimary),
    byOrgPublished: index("store_org_published_idx").on(t.organizationId, t.isPublished),
  }),
);

export const storeRelations = relations(store, ({ one, many }) => ({
  organization: one(organization, {
    fields: [store.organizationId],
    references: [organization.id],
  }),
  staff: many(storeStaff),
}));

/**
 * `store_staff` — which employees work at which stores (M:N). An employee
 * (`userId` → the staff `user`) can be assigned to several stores; the register
 * limits the active-store switcher to a cashier's assignments, and stats split
 * by store. Created on invite-accept from `invitation.assignedStoreIds`, edited
 * from the employee wizard.
 */
export const storeStaff = sqliteTable(
  "store_staff",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    storeId: text("store_id")
      .notNull()
      .references(() => store.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (t) => ({
    userStoreUq: uniqueIndex("store_staff_user_store_uq").on(t.userId, t.storeId),
    byOrgUser: index("store_staff_org_user_idx").on(t.organizationId, t.userId),
    byStore: index("store_staff_store_idx").on(t.storeId),
  }),
);

export const storeStaffRelations = relations(storeStaff, ({ one }) => ({
  organization: one(organization, {
    fields: [storeStaff.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [storeStaff.userId],
    references: [user.id],
  }),
  store: one(store, {
    fields: [storeStaff.storeId],
    references: [store.id],
  }),
}));

export type StoreRow = typeof store.$inferSelect;
export type StoreInsert = typeof store.$inferInsert;
export type StoreStaffRow = typeof storeStaff.$inferSelect;
export type StoreStaffInsert = typeof storeStaff.$inferInsert;

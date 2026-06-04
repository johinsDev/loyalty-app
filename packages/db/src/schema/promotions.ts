import { relations } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { organization, user } from "./auth";

/**
 * `promo` — a marketing promotion built through the multi-step wizard
 * (`@loyalty/api` `features/promotions`). Entity-as-draft: the row exists from
 * step 1 in `status = "draft"`, with its domain columns filled progressively by
 * each step and left nullable until then; `publish` runs full validation and
 * flips `status = "published"`. The current step is NOT stored — it's derived
 * from which columns are filled (see the `Wizard` engine).
 *
 * `segmentId` is a plain string here (the segments domain doesn't exist yet); in
 * a real build it would FK to a `segment` table. See `.claude/skills/wizard/SKILL.md`.
 */
export const promo = sqliteTable(
  "promo",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Lifecycle: "draft" → "published" (→ "archived" later, out of scope).
    status: text("status").notNull().default("draft"),

    // step "segment" (basics + target)
    name: text("name"),
    segmentId: text("segment_id"),
    // step "products"
    productIds: text("product_ids", { mode: "json" }).$type<string[]>(),
    // step "branding"
    branding: text("branding", { mode: "json" }).$type<{
      icon: string;
      color: string;
    }>(),
    // step "schedule"
    startsAt: integer("starts_at", { mode: "timestamp" }),
    endsAt: integer("ends_at", { mode: "timestamp" }),

    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    publishedAt: integer("published_at", { mode: "timestamp" }),
  },
  (t) => ({
    orgStatusIdx: index("promo_org_status_idx").on(t.organizationId, t.status),
  }),
);

export type PromoRow = typeof promo.$inferSelect;
export type PromoInsert = typeof promo.$inferInsert;

export const promoRelations = relations(promo, ({ one }) => ({
  organization: one(organization, {
    fields: [promo.organizationId],
    references: [organization.id],
  }),
  createdBy: one(user, {
    fields: [promo.createdByUserId],
    references: [user.id],
  }),
}));

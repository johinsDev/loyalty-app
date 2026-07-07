import { relations } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { organization, user } from "./auth";

export type PromoItemRef = {
  kind: "product" | "variant" | "category" | "modifierOption";
  id: string;
};

/** N units matching ANY of `refs` (empty refs = any unit in the cart). */
export type PromoLineRequirement = { refs: PromoItemRef[]; qty: number };

/** Requirements are ANDed; `[]` means no item requirement. */
export type PromoTrigger = {
  requirements: PromoLineRequirement[];
  minSubtotalCents?: number;
};

export type PromoEffectTarget = "buy" | "get" | "order";

export type PromoEffect =
  | {
      kind: "percentOff";
      percent: number;
      target: PromoEffectTarget;
      select?: { count: number; pick: "cheapest" };
      maxDiscountCents?: number;
    }
  | { kind: "amountOff"; amountCents: number; target: PromoEffectTarget }
  | { kind: "fixedPrice"; priceCents: number }
  | { kind: "freeUnits"; count: number; target: PromoEffectTarget }
  | { kind: "tieredPercent"; tiers: { minQty: number; percent: number }[] }
  | { kind: "pointsMultiplier"; multiplier: number };

/**
 * The generic rule every curated promo type compiles to. The engine only ever
 * reads this JSON; `promo.type` exists for the wizard forms, list facets and
 * the benefit-copy formatter.
 */
export type PromoRule = {
  buy: PromoTrigger;
  get?: { requirements: PromoLineRequirement[] };
  effect: PromoEffect;
  maxApplicationsPerOrder?: number;
};

export type PromoRecurrence =
  | { kind: "weekly"; days: number[] } // 0 (Sun) – 6 (Sat)
  | { kind: "monthlyDay"; day: number } // 1–31; 29–31 skip short months
  | { kind: "monthlyNthWeekday"; nth: 1 | 2 | 3 | 4 | -1; weekday: number }
  | { kind: "dates"; dates: string[] }; // "YYYY-MM-DD" in org-local time

/** Refines availability inside the startsAt/endsAt window (org-local time). */
export type PromoSchedule = {
  recurrence?: PromoRecurrence;
  timeWindow?: { from: string; to: string }; // "HH:mm"; from > to spans midnight
  excludedDates?: string[];
};

/** Non-queryable conditions (the queryable ones are first-class columns). */
export type PromoConditions = {
  minPurchaseCents?: number;
  maxUsesTotal?: number;
  maxPerCustomer?: number;
  lastPurchaseOlderThanDays?: number;
  purchaseCount?: { min?: number; max?: number };
};

/**
 * `promo` — a discount/benefit rule built through the server-driven wizard
 * (`@loyalty/api` `features/promotions`). Entity-as-draft: the row exists from
 * step 1 in `status = "draft"`, with its domain columns filled progressively by
 * each step and left nullable until then; `publish` runs full validation and
 * flips `status = "published"`. The current step is NOT stored — it's derived
 * from which columns are filled (see the `Wizard` engine and
 * `.claude/skills/wizard/SKILL.md`).
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

    // Lifecycle: "draft" → "published" → "archived".
    status: text("status").notNull().default("draft"),

    name: text("name"),
    startsAt: integer("starts_at", { mode: "timestamp" }),
    endsAt: integer("ends_at", { mode: "timestamp" }),

    slug: text("slug"),
    // Curated type discriminant (percentOff | amountOff | nxm | secondUnit |
    // bundle | combo | crossSell | cartThreshold | volumeTiered | pointsMultiplier).
    // Drives wizard forms, list facets and the copy formatter; the engine only
    // reads `rule`.
    type: text("type"),
    rule: text("rule", { mode: "json" }).$type<PromoRule>(),
    schedule: text("schedule", { mode: "json" }).$type<PromoSchedule>(),
    conditions: text("conditions", { mode: "json" }).$type<PromoConditions>(),
    audienceType: text("audience_type").notNull().default("all"), // all | tier | specific
    tierKey: text("tier_key"),
    audienceCustomerIds: text("audience_customer_ids", { mode: "json" }).$type<string[]>(),

    // Visual / content
    shortDescription: text("short_description"),
    longDescription: text("long_description"),
    badgeLabel: text("badge_label"), // e.g. "2×1"
    icon: text("icon"),
    backgroundCss: text("background_css"),
    mainImageUrl: text("main_image_url"),
    category: text("category"), // promo section/category tag
    featured: integer("featured", { mode: "boolean" }).notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    ogImageUrl: text("og_image_url"),

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
    slugPerOrg: uniqueIndex("promo_slug_per_org_uq").on(t.organizationId, t.slug),
  }),
);

export type PromoRow = typeof promo.$inferSelect;
export type PromoInsert = typeof promo.$inferInsert;

export const promoRelations = relations(promo, ({ one, many }) => ({
  organization: one(organization, {
    fields: [promo.organizationId],
    references: [organization.id],
  }),
  createdBy: one(user, {
    fields: [promo.createdByUserId],
    references: [user.id],
  }),
  translations: many(promoTranslation),
}));

// Per-locale content overrides (base columns = default locale). Slug canonical.
export const promoTranslation = sqliteTable(
  "promo_translation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    promoId: text("promo_id")
      .notNull()
      .references(() => promo.id, { onDelete: "cascade" }),
    locale: text("locale").notNull(),
    name: text("name").notNull(),
    shortDescription: text("short_description"),
    longDescription: text("long_description"),
    badgeLabel: text("badge_label"),
  },
  (t) => ({
    uq: uniqueIndex("promo_translation_uq").on(t.promoId, t.locale),
  }),
);

export const promoTranslationRelations = relations(promoTranslation, ({ one }) => ({
  promo: one(promo, { fields: [promoTranslation.promoId], references: [promo.id] }),
}));

export type PromoTranslationRow = typeof promoTranslation.$inferSelect;

import { relations } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { organization } from "./auth";
import type { StoreHours } from "./store";

/**
 * Global "Smart Delivery" rules for the campaigns engine. Applied to
 * promotional (and, later, automated) sends — never to transactional.
 */
export type SmartDeliveryRules = {
  /** Max promotional messages per customer per rolling 7 days; null = no cap. */
  frequencyCapPerWeek: number | null;
  /** Quiet-hours window (org-local "HH:mm"); non-critical sends defer to its end. */
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

/**
 * One first-run onboarding step for the customer PWA carousel. Authored in the
 * admin; the customer app renders title → tiptap `body` over `backgroundCss`,
 * with `icon` (an emoji or an uploaded image URL) above. `icon` + `backgroundCss`
 * are canonical (not translated); `text` holds the per-locale copy, keyed by
 * locale — the org default locale is the fallback. Stored as a JSON array on
 * `organization_settings` (≤10 steps); no separate table, since it's edited as
 * one config blob, not a CRUD list.
 */
export type OnboardingStepText = { title: string; body: string };
export type OnboardingStep = {
  id: string;
  /** Emoji, or an uploaded image URL (from `IconPicker`). */
  icon: string;
  /** CSS `background` string — a template gradient/pattern or `url(<r2>)`. */
  backgroundCss: string;
  /** Per-locale copy, keyed by locale code (e.g. `es`, `en`). */
  text: Record<string, OnboardingStepText>;
};

/** Brand social links (only filled keys are shown in the customer app). */
export type SocialLinks = {
  instagram?: string;
  whatsapp?: string;
  facebook?: string;
  tiktok?: string;
  x?: string;
  website?: string;
};

/**
 * Which loyalty tracks the org runs. The enum (not two booleans) makes the
 * invalid "everything off" state unrepresentable — at least one track is
 * always on. `points` means stamps are OFF and vice versa.
 */
export type LoyaltyMode = "stamps" | "points" | "both";

/** Points earn rule for one currency: every `per` major units → `points`. */
export type PointsRate = { per: number; points: number };

/**
 * Visual style of one stamp spot on the customer card. `icon` is either a key
 * from the curated lucide set in `@loyalty/ui` or an uploaded image URL —
 * both render as a tintable silhouette (CSS mask), so `onColor` always works.
 * Null column → defaults (cup-soda, brand primary, "dim").
 */
export type StampStyle = {
  icon: { kind: "lucide" | "image"; value: string };
  /** Hex for the filled stamp; null → the brand primary. */
  onColor: string | null;
  /** How an unearned spot renders: dimmed icon, outline, or its number. */
  offStyle: "dim" | "outline" | "number";
};

/** Editable stamp-card texts; every key optional → i18n default fallback. */
export type StampCardCopyKey =
  | "title"
  | "subtitle"
  | "filledTitle"
  | "filledBody"
  | "emptyTitle"
  | "emptyBody"
  | "rewardTitle"
  | "rewardBody"
  | "paused";
export type StampCardCopy = Record<
  string,
  Partial<Record<StampCardCopyKey, string>>
>;

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

  // Org-level contact + default schedule that individual stores inherit when
  // their own `phone` / `hours` are null (per-store override otherwise).
  phone: text("phone"),
  defaultHours: text("default_hours", { mode: "json" }).$type<StoreHours>(),

  // Wallet scope across stores: "org" = shared (today), "store" = per-branch
  // (enforcement deferred — see docs/store-config.md backlog).
  loyaltyScope: text("loyalty_scope").notNull().default("org"),

  // ── Loyalty earn config (org-level; per-store is a future extension) ──────
  // Which tracks earn: stamps | points | both. Redemption is never gated —
  // a paused track's balances stay spendable.
  loyaltyMode: text("loyalty_mode").$type<LoyaltyMode>().notNull().default("both"),
  // Points earn rule per currency, keyed by currency code. Null → the code
  // default (100 COP → 4 pts). Every enabled currency must have an entry
  // (enforced by the settings service on write).
  pointsRates: text("points_rates", { mode: "json" }).$type<Record<string, PointsRate>>(),
  // Points-card visual template for the customer PWA home (PR 2 gallery).
  pointsCardTemplate: text("points_card_template").notNull().default("classic"),
  // Post-reactivation tier grace: until this instant, tier recomputes may only
  // raise a customer's tier (the 30d earn window restarts empty on re-enable,
  // so without this everyone would drop the day after points come back).
  tierGraceUntil: integer("tier_grace_until", { mode: "timestamp" }),

  // ── Discount stacking policy (register checkout) ──────────────────────────
  // How the three discount layers (reward · promo · tier %) combine at the
  // register. Order is always reward → promo → tier; these gate which layers
  // may co-apply, plus a max total-discount cap (% of subtotal; 100 = no cap).
  tierStacksWithPromo: integer("tier_stacks_with_promo", { mode: "boolean" })
    .notNull()
    .default(true),
  rewardStacksWithPromo: integer("reward_stacks_with_promo", { mode: "boolean" })
    .notNull()
    .default(true),
  maxTotalDiscountPct: integer("max_total_discount_pct").notNull().default(100),

  // ── Stamps config (org-level) ─────────────────────────────────────────────
  // The catalog reward that IS the card prize; its `stampsRequired` is the
  // single source of truth for the stamps goal. Plain text (no FK) to avoid a
  // loyalty.ts ↔ organization-settings.ts import cycle — the settings service
  // validates org + published on write. Null / broken link → runtime fallback
  // (goal 9, generic gift copy) and an admin nudge to link one.
  stampsCardRewardId: text("stamps_card_reward_id"),
  // 1 stamp per N *eligible* purchases (progress persisted on loyalty_card).
  purchasesPerStamp: integer("purchases_per_stamp").notNull().default(1),
  // Minimum net ticket (cents) per currency for a purchase to count toward a
  // stamp. Missing/0 entry = no minimum for that currency.
  stampMinAmount: text("stamp_min_amount", { mode: "json" }).$type<
    Record<string, number>
  >(),
  // Category allowlist for earning stamps: an itemized purchase counts when at
  // least one item's product is in one of these. Null/empty = all categories.
  // Item-less (amount-only) purchases always count.
  stampCategoryIds: text("stamp_category_ids", { mode: "json" }).$type<
    string[]
  >(),
  // Stamps-card visual template for the customer PWA home.
  stampsCardTemplate: text("stamps_card_template").notNull().default("classic"),
  stampStyle: text("stamp_style", { mode: "json" }).$type<StampStyle>(),
  // Per-locale copy overrides for the stamps card + its tap modals.
  stampsCardCopy: text("stamps_card_copy", { mode: "json" }).$type<StampCardCopy>(),

  // Global campaign "Smart Delivery" rules (frequency cap + quiet hours).
  smartDelivery: text("smart_delivery", { mode: "json" }).$type<SmartDeliveryRules>(),

  // First-run onboarding carousel for the customer PWA (≤10 steps). Null/empty
  // → the app shows its built-in default so the sign-in never renders blank.
  onboarding: text("onboarding", { mode: "json" }).$type<OnboardingStep[]>(),

  // ── SEO (consumed by the apps' root metadata) ─────────────────────────────
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  seoKeywords: text("seo_keywords", { mode: "json" }).$type<string[]>(),
  ogImageUrl: text("og_image_url"),
  faviconUrl: text("favicon_url"), // uploaded favicon (R2) → app metadata icons

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

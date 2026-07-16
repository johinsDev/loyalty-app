import type {
  StampCardCopy,
  StampCardCopyKey,
  StampStyle,
  StoreHours,
} from "@loyalty/db/schema";
import { z } from "zod";

import { SUPPORTED_CURRENCIES, SUPPORTED_LOCALES } from "../_shared/localize";
import { hoursSchema } from "../stores/schemas";

export const localeSchema = z.enum(SUPPORTED_LOCALES);
export const currencySchema = z.enum(SUPPORTED_CURRENCIES);

export const updateLocalizationInputSchema = z
  .object({
    defaultLocale: localeSchema,
    enabledLocales: z.array(localeSchema).min(1),
    defaultCurrency: currencySchema,
    enabledCurrencies: z.array(currencySchema).min(1),
  })
  .refine((v) => v.enabledLocales.includes(v.defaultLocale), {
    message: "defaultLocale must be one of enabledLocales",
    path: ["defaultLocale"],
  })
  .refine((v) => v.enabledCurrencies.includes(v.defaultCurrency), {
    message: "defaultCurrency must be one of enabledCurrencies",
    path: ["defaultCurrency"],
  });

export type UpdateLocalizationInput = z.infer<typeof updateLocalizationInputSchema>;

export interface LocalizationView {
  defaultLocale: string;
  enabledLocales: string[];
  defaultCurrency: string;
  enabledCurrencies: string[];
}

// ─── Branding ────────────────────────────────────────────────────────────────
const optionalUrl = z.string().url().optional().or(z.literal(""));

export const socialLinksSchema = z
  .object({
    instagram: optionalUrl,
    whatsapp: z.string().max(40).optional().or(z.literal("")),
    facebook: optionalUrl,
    tiktok: optionalUrl,
    x: optionalUrl,
    website: optionalUrl,
  })
  .partial();

export const updateBrandingInputSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  logoUrl: optionalUrl,
  brandColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional()
    .or(z.literal("")),
  socialLinks: socialLinksSchema.optional(),
  termsPdfUrl: optionalUrl,
  // Org-level contact + default schedule (stores inherit these when unset).
  phone: z.string().max(40).optional().or(z.literal("")),
  defaultHours: hoursSchema.nullish(),
});
export type UpdateBrandingInput = z.infer<typeof updateBrandingInputSchema>;

export const updateSeoInputSchema = z.object({
  seoTitle: z.string().max(160).optional(),
  seoDescription: z.string().max(320).optional(),
  seoKeywords: z.array(z.string().max(40)).max(20).optional(),
  ogImageUrl: optionalUrl,
  faviconUrl: optionalUrl,
});
export type UpdateSeoInput = z.infer<typeof updateSeoInputSchema>;

export const loyaltyScopeSchema = z.enum(["org", "store"]);
export const setLoyaltyScopeInputSchema = z.object({ loyaltyScope: loyaltyScopeSchema });
export type SetLoyaltyScopeInput = z.infer<typeof setLoyaltyScopeInputSchema>;

// ─── Smart Delivery (campaign global rules) ──────────────────────────────────
const hhMm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm");
export const updateSmartDeliveryInputSchema = z
  .object({
    frequencyCapPerWeek: z.number().int().min(1).max(50).nullable(),
    quietHoursStart: hhMm.nullable(),
    quietHoursEnd: hhMm.nullable(),
  })
  .refine((v) => (v.quietHoursStart == null) === (v.quietHoursEnd == null), {
    message: "Set both quiet-hours ends or neither",
    path: ["quietHoursEnd"],
  });
export type UpdateSmartDeliveryInput = z.infer<typeof updateSmartDeliveryInputSchema>;

export interface SmartDeliveryView {
  frequencyCapPerWeek: number | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export interface BrandingView {
  name: string;
  description: string | null;
  logoUrl: string | null;
  brandColor: string | null;
  socialLinks: Record<string, string>;
  termsPdfUrl: string | null;
  phone: string | null;
  defaultHours: StoreHours | null;
  loyaltyScope: string;
  seo: {
    title: string | null;
    description: string | null;
    keywords: string[];
    ogImageUrl: string | null;
    faviconUrl: string | null;
  };
}

// ─── Onboarding ──────────────────────────────────────────────────────────────
export const MAX_ONBOARDING_STEPS = 10;

/** Per-locale copy for one step, keyed by locale (`es`, `en`, …). Every entry's
 *  title is trimmed; body is tiptap HTML. A locale may be absent (falls back to
 *  the org default at read time). */
const onboardingTextSchema = z.record(
  localeSchema,
  z.object({
    title: z.string().trim().max(120),
    body: z.string().max(4000),
  }),
);

export const onboardingStepSchema = z.object({
  id: z.string().min(1).max(60),
  /** Emoji or an uploaded image URL. */
  icon: z.string().trim().min(1).max(2000),
  /** CSS `background` string (template or `url(<r2>)`). */
  backgroundCss: z.string().trim().min(1).max(4000),
  text: onboardingTextSchema,
});

export const updateOnboardingInputSchema = z.object({
  steps: z.array(onboardingStepSchema).min(1).max(MAX_ONBOARDING_STEPS),
});
export type UpdateOnboardingInput = z.infer<typeof updateOnboardingInputSchema>;

/** Raw admin view — every step with all locales, for the editor. */
export interface OnboardingAdminStep {
  id: string;
  icon: string;
  backgroundCss: string;
  text: Record<string, { title: string; body: string }>;
}

/** Customer view — each step resolved to the requested locale. */
export interface OnboardingStepView {
  id: string;
  icon: string;
  backgroundCss: string;
  title: string;
  body: string;
}

// ─── Loyalty earn config ─────────────────────────────────────────────────────

export const loyaltyModeSchema = z.enum(["stamps", "points", "both"]);
export type LoyaltyModeInput = z.infer<typeof loyaltyModeSchema>;

/** One currency's earn rule: every `per` major units of spend → `points`. */
export const pointsRateSchema = z.object({
  per: z.number().int().min(1).max(10_000_000),
  points: z.number().int().min(1).max(100_000),
});

export const updateLoyaltyConfigInputSchema = z.object({
  mode: loyaltyModeSchema,
  /** Keyed by currency code. The service enforces that every enabled currency
   *  has an entry (zod can't see the org's enabledCurrencies). */
  pointsRates: z.record(currencySchema, pointsRateSchema),
  pointsCardTemplate: z.string().min(1).max(40).optional(),
});
export type UpdateLoyaltyConfigInput = z.infer<typeof updateLoyaltyConfigInputSchema>;

/** Public view — what the PWA needs pre-render. Rates stay manager-only. */
export interface LoyaltyConfigView {
  mode: LoyaltyModeInput;
  pointsCardTemplate: string;
  stampsCard: StampsCardPublicView;
}

/** Admin view — mode + points config for the Lealtad editor (the stamps side
 *  has its own `StampsConfigAdminView`). */
export interface LoyaltyConfigAdminView {
  mode: LoyaltyModeInput;
  pointsCardTemplate: string;
  pointsRates: Record<string, { per: number; points: number }>;
  tierGraceUntil: Date | null;
}

// ─── Stamps config ───────────────────────────────────────────────────────────

export const STAMPS_GOAL_MIN = 3;
export const STAMPS_GOAL_MAX = 12;

export const stampStyleSchema = z.object({
  icon: z.object({
    kind: z.enum(["lucide", "image"]),
    /** Curated icon key, or the uploaded image URL (rendered as a CSS mask). */
    value: z.string().trim().min(1).max(2000),
  }),
  onColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable(),
  offStyle: z.enum(["dim", "outline", "number"]),
}) satisfies z.ZodType<StampStyle>;

export const STAMP_CARD_COPY_KEYS = [
  "title",
  "subtitle",
  "filledTitle",
  "filledBody",
  "emptyTitle",
  "emptyBody",
  "rewardTitle",
  "rewardBody",
  "paused",
] as const satisfies readonly StampCardCopyKey[];

/**
 * Placeholder policy per copy key: an override may only use `allowed` tokens
 * (anything else renders literally in the PWA) and must keep every `required`
 * one (the text is meaningless without it). Enforced by the service on save.
 */
export const STAMP_COPY_PLACEHOLDERS: Record<
  StampCardCopyKey,
  { allowed: string[]; required: string[] }
> = {
  title: { allowed: [], required: [] },
  subtitle: { allowed: ["count"], required: [] },
  filledTitle: { allowed: [], required: [] },
  filledBody: { allowed: [], required: [] },
  emptyTitle: { allowed: [], required: [] },
  emptyBody: { allowed: ["count"], required: ["count"] },
  rewardTitle: { allowed: [], required: [] },
  rewardBody: { allowed: [], required: [] },
  paused: { allowed: [], required: [] },
};

/** Per-locale overrides; a missing key falls back to the app's i18n default. */
export const stampsCardCopySchema = z.record(
  localeSchema,
  z.record(z.enum(STAMP_CARD_COPY_KEYS), z.string().trim().min(1).max(300)),
);

export const updateStampsConfigInputSchema = z.object({
  /** The catalog reward that IS the card prize; null unlinks (goal falls back). */
  cardRewardId: z.string().min(1).nullable(),
  /** Saved onto the linked reward's `stampsRequired` (single source of truth). */
  goal: z.number().int().min(STAMPS_GOAL_MIN).max(STAMPS_GOAL_MAX),
  purchasesPerStamp: z.number().int().min(1).max(10),
  /** Minimum net ticket (cents) per currency; 0/absent = no minimum. */
  minAmount: z.record(currencySchema, z.number().int().min(0).max(100_000_000)),
  /** Category allowlist for earning; empty = every category counts. */
  categoryIds: z.array(z.string().min(1)).max(50),
  template: z.string().min(1).max(40),
  style: stampStyleSchema.nullable(),
  copy: stampsCardCopySchema,
});
export type UpdateStampsConfigInput = z.infer<typeof updateStampsConfigInputSchema>;

/** What the PWA stamp card needs pre-render (public, locale-resolved). */
export interface StampsCardPublicView {
  template: string;
  goal: number;
  purchasesPerStamp: number;
  style: StampStyle | null;
  /** Overrides only — the app falls back to its i18n defaults per key. */
  copy: Partial<Record<StampCardCopyKey, string>>;
  /** Localized name/description of the linked card reward (null = unlinked). */
  prize: { name: string; description: string | null } | null;
}

/** Admin editor view — raw copy (all locales) + link health + picker options. */
export interface StampsConfigAdminView {
  cardRewardId: string | null;
  /** A saved link points at a reward that is no longer published/stamps-priced. */
  brokenLink: boolean;
  goal: number;
  purchasesPerStamp: number;
  minAmount: Record<string, number>;
  categoryIds: string[];
  template: string;
  style: StampStyle | null;
  copy: StampCardCopy;
  linkedReward: {
    id: string;
    name: string;
    stampsRequired: number | null;
    status: string;
  } | null;
  rewardOptions: { id: string; name: string; stampsRequired: number | null }[];
}

/** Static inputs for the live equivalence panel; the per-keystroke math is
 *  client-side. `avgTicketCents` falls back to the catalog average (flagged by
 *  `source`) until the org has real sales. */
export interface LoyaltyInsights {
  perCurrency: {
    currency: string;
    avgTicketCents: number | null;
    source: "purchases" | "catalog";
  }[];
  pointsRewards: { id: string; name: string; icon: string | null; pointsCost: number }[];
  multiplierPromos: { id: string; name: string; multiplier: number }[];
}

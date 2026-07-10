import type { StoreHours } from "@loyalty/db/schema";
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

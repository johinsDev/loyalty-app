import { z } from "zod";

import { SUPPORTED_CURRENCIES, SUPPORTED_LOCALES } from "../_shared/localize";

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
});
export type UpdateBrandingInput = z.infer<typeof updateBrandingInputSchema>;

export const updateSeoInputSchema = z.object({
  seoTitle: z.string().max(160).optional(),
  seoDescription: z.string().max(320).optional(),
  seoKeywords: z.array(z.string().max(40)).max(20).optional(),
  ogImageUrl: optionalUrl,
});
export type UpdateSeoInput = z.infer<typeof updateSeoInputSchema>;

export const loyaltyScopeSchema = z.enum(["org", "store"]);
export const setLoyaltyScopeInputSchema = z.object({ loyaltyScope: loyaltyScopeSchema });
export type SetLoyaltyScopeInput = z.infer<typeof setLoyaltyScopeInputSchema>;

export interface BrandingView {
  name: string;
  description: string | null;
  logoUrl: string | null;
  brandColor: string | null;
  socialLinks: Record<string, string>;
  termsPdfUrl: string | null;
  loyaltyScope: string;
  seo: {
    title: string | null;
    description: string | null;
    keywords: string[];
    ogImageUrl: string | null;
  };
}

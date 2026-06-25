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

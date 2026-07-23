import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCALIZATION,
  pickPrice,
  pickTranslation,
  resolveLocaleCurrency,
  type LocaleContext,
} from "../localize";
import { updateLocalizationInputSchema } from "../../settings/schemas";

const loc = {
  defaultLocale: "es",
  enabledLocales: ["es", "en"],
  defaultCurrency: "COP",
  enabledCurrencies: ["COP", "USD"],
  defaultPhoneCountry: null,
};
const h = (o: Record<string, string>) => new Headers(o);

describe("resolveLocaleCurrency", () => {
  it("uses requested values when enabled", () => {
    const r = resolveLocaleCurrency(h({ "x-locale": "en", "x-currency": "USD" }), loc);
    expect(r.locale).toBe("en");
    expect(r.currency).toBe("USD");
  });

  it("falls back to defaults when not enabled or absent", () => {
    expect(resolveLocaleCurrency(h({ "x-locale": "fr", "x-currency": "EUR" }), loc)).toMatchObject({
      locale: "es",
      currency: "COP",
    });
    expect(resolveLocaleCurrency(h({}), loc)).toMatchObject({ locale: "es", currency: "COP" });
  });

  it("clamps to the single enabled set (default localization)", () => {
    const r = resolveLocaleCurrency(h({ "x-locale": "en", "x-currency": "USD" }), DEFAULT_LOCALIZATION);
    expect(r).toMatchObject({ locale: "es", currency: "COP" });
  });
});

describe("pickTranslation", () => {
  const base = { name: "Matcha", description: "<p>es</p>" };
  const rows = [{ locale: "en", name: "Matcha EN", description: "<p>en</p>" }];
  const ctx = (locale: string): Pick<LocaleContext, "locale" | "defaultLocale"> => ({
    locale,
    defaultLocale: "es",
  });

  it("returns base for the default locale", () => {
    expect(pickTranslation(base, rows, ctx("es"))).toEqual({ name: "Matcha", description: "<p>es</p>" });
  });
  it("returns the override when present", () => {
    expect(pickTranslation(base, rows, ctx("en"))).toEqual({ name: "Matcha EN", description: "<p>en</p>" });
  });
  it("falls back to base when no override", () => {
    expect(pickTranslation(base, [], ctx("en"))).toEqual({ name: "Matcha", description: "<p>es</p>" });
  });
});

describe("pickPrice", () => {
  const ctx = (currency: string): Pick<LocaleContext, "currency" | "defaultCurrency"> => ({
    currency,
    defaultCurrency: "COP",
  });

  it("returns base for the default currency", () => {
    expect(pickPrice(1650000, "COP", [], ctx("COP"))).toEqual({ priceCents: 1650000, currency: "COP" });
  });
  it("returns the per-currency amount when present", () => {
    expect(pickPrice(1650000, "COP", [{ currency: "USD", amountCents: 412 }], ctx("USD"))).toEqual({
      priceCents: 412,
      currency: "USD",
    });
  });
  it("falls back to the default-currency price when missing", () => {
    expect(pickPrice(1650000, "COP", [], ctx("USD"))).toEqual({ priceCents: 1650000, currency: "COP" });
  });
});

describe("updateLocalizationInputSchema", () => {
  it("rejects a default outside the enabled set", () => {
    const r = updateLocalizationInputSchema.safeParse({
      defaultLocale: "en",
      enabledLocales: ["es"],
      defaultCurrency: "COP",
      enabledCurrencies: ["COP"],
    });
    expect(r.success).toBe(false);
  });
  it("accepts a valid config", () => {
    const r = updateLocalizationInputSchema.safeParse({
      defaultLocale: "es",
      enabledLocales: ["es", "en"],
      defaultCurrency: "COP",
      enabledCurrencies: ["COP", "USD"],
    });
    expect(r.success).toBe(true);
  });
});

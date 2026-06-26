import { CacheManager } from "@loyalty/cache";
import type { db as Db } from "@loyalty/db";
import { organization, organizationSettings } from "@loyalty/db/schema";
import { eq } from "drizzle-orm";

// v1 supported sets. Enabled values are clamped to these in the settings service.
export const SUPPORTED_LOCALES = ["es", "en"] as const;
export const SUPPORTED_CURRENCIES = ["COP", "USD"] as const;

export interface Localization {
  defaultLocale: string;
  enabledLocales: string[];
  defaultCurrency: string;
  enabledCurrencies: string[];
}

export const DEFAULT_LOCALIZATION: Localization = {
  defaultLocale: "es",
  enabledLocales: ["es"],
  defaultCurrency: "COP",
  enabledCurrencies: ["COP"],
};

/** Active locale + currency for a request, plus the org defaults (for fallback). */
export interface LocaleContext {
  locale: string;
  currency: string;
  defaultLocale: string;
  defaultCurrency: string;
}

const TTL_SECONDS = 600;
const cache = new CacheManager({
  default: "memory",
  stores: { memory: { provider: "memory" } },
});
const key = (orgId: string) => `org-settings:${orgId}`;

/** Read the org's localization config (cached). Returns defaults when unset. */
export function getLocalization(db: typeof Db, orgId: string): Promise<Localization> {
  return cache.getOrSet(
    key(orgId),
    async () => {
      const rows = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, orgId))
        .limit(1);
      const row = rows[0];
      if (!row) return DEFAULT_LOCALIZATION;
      return {
        defaultLocale: row.defaultLocale,
        enabledLocales: row.enabledLocales,
        defaultCurrency: row.defaultCurrency,
        enabledCurrencies: row.enabledCurrencies,
      };
    },
    TTL_SECONDS,
  );
}

export async function invalidateLocalization(orgId: string): Promise<void> {
  await cache.delete(key(orgId));
}

/** Org branding (name/logo/color/social/T&C/SEO + loyalty scope) — drives the
 *  customer app theme + store profile. Cached; consumed at SSR. */
export interface Branding {
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

const brandingKey = (orgId: string) => `org-branding:${orgId}`;

export function getBranding(db: typeof Db, orgId: string): Promise<Branding> {
  return cache.getOrSet(
    brandingKey(orgId),
    async () => {
      const [orgRow] = await db
        .select({ name: organization.name, logo: organization.logo })
        .from(organization)
        .where(eq(organization.id, orgId))
        .limit(1);
      const [s] = await db
        .select()
        .from(organizationSettings)
        .where(eq(organizationSettings.organizationId, orgId))
        .limit(1);
      return {
        name: orgRow?.name ?? "",
        description: s?.description ?? null,
        logoUrl: orgRow?.logo ?? null,
        brandColor: s?.brandColor ?? null,
        socialLinks: (s?.socialLinks ?? {}) as Record<string, string>,
        termsPdfUrl: s?.termsPdfUrl ?? null,
        loyaltyScope: s?.loyaltyScope ?? "org",
        seo: {
          title: s?.seoTitle ?? null,
          description: s?.seoDescription ?? null,
          keywords: s?.seoKeywords ?? [],
          ogImageUrl: s?.ogImageUrl ?? null,
        },
      };
    },
    TTL_SECONDS,
  );
}

export async function invalidateBranding(orgId: string): Promise<void> {
  await cache.delete(brandingKey(orgId));
}

/** Resolve the active locale/currency from request headers, clamped to what the
 *  org enables (anything else → the org default). */
export function resolveLocaleCurrency(
  headers: Headers,
  loc: Localization,
): LocaleContext {
  const wantedLocale = headers.get("x-locale") ?? "";
  const wantedCurrency = headers.get("x-currency") ?? "";
  return {
    locale: loc.enabledLocales.includes(wantedLocale) ? wantedLocale : loc.defaultLocale,
    currency: loc.enabledCurrencies.includes(wantedCurrency)
      ? wantedCurrency
      : loc.defaultCurrency,
    defaultLocale: loc.defaultLocale,
    defaultCurrency: loc.defaultCurrency,
  };
}

/** Load the active locale context for a request (cached settings read). */
export async function loadLocaleContext(
  db: typeof Db,
  orgId: string,
  headers: Headers,
): Promise<LocaleContext> {
  const loc = await getLocalization(db, orgId);
  return resolveLocaleCurrency(headers, loc);
}

interface TranslationRow {
  locale: string;
  name: string;
  description?: string | null;
}

/** Pick localized text: the matching translation row, else the default-locale
 *  base content. */
export function pickTranslation<T extends { name: string; description?: string | null }>(
  base: T,
  rows: TranslationRow[],
  ctx: Pick<LocaleContext, "locale" | "defaultLocale">,
): { name: string; description: string | null } {
  if (ctx.locale === ctx.defaultLocale) {
    return { name: base.name, description: base.description ?? null };
  }
  const hit = rows.find((r) => r.locale === ctx.locale);
  return hit
    ? { name: hit.name, description: hit.description ?? null }
    : { name: base.name, description: base.description ?? null };
}

interface PriceRow {
  currency: string;
  amountCents: number;
}

/** Pick the price for the active currency: the matching price row, else the
 *  real default-currency price (with the default currency code). */
export function pickPrice(
  baseCents: number,
  baseCurrency: string,
  rows: PriceRow[],
  ctx: Pick<LocaleContext, "currency" | "defaultCurrency">,
): { priceCents: number; currency: string } {
  if (ctx.currency === baseCurrency) {
    return { priceCents: baseCents, currency: baseCurrency };
  }
  const hit = rows.find((r) => r.currency === ctx.currency);
  return hit
    ? { priceCents: hit.amountCents, currency: ctx.currency }
    : { priceCents: baseCents, currency: baseCurrency };
}

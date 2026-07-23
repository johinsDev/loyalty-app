import { CacheManager } from "@loyalty/cache";
import type { db as Db } from "@loyalty/db";
import {
  type LoyaltyMode,
  organization,
  organizationSettings,
  type PointsRate,
  reward,
  type StampCardCopy,
  type StampStyle,
  type StoreHours,
} from "@loyalty/db/schema";
import { eq } from "drizzle-orm";

import type { StackingPolicy } from "./checkout-math";

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
  /** Org-level contact + default schedule that stores inherit when unset. */
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
        phone: s?.phone ?? null,
        defaultHours: s?.defaultHours ?? null,
        loyaltyScope: s?.loyaltyScope ?? "org",
        seo: {
          title: s?.seoTitle ?? null,
          description: s?.seoDescription ?? null,
          keywords: s?.seoKeywords ?? [],
          ogImageUrl: s?.ogImageUrl ?? null,
          faviconUrl: s?.faviconUrl ?? null,
        },
      };
    },
    TTL_SECONDS,
  );
}

export async function invalidateBranding(orgId: string): Promise<void> {
  await cache.delete(brandingKey(orgId));
}

/**
 * Org loyalty earn config — which tracks earn (mode), the per-currency points
 * rate, the PWA card template and the post-reactivation tier grace. Cached like
 * localization/branding; read on EVERY purchase, so it must stay cheap.
 * `pointsRates` always carries an entry for the default currency (the code
 * default seeds it when the org never saved one).
 */
export interface LoyaltyConfig {
  mode: LoyaltyMode;
  pointsRates: Record<string, PointsRate>;
  pointsCardTemplate: string;
  tierGraceUntil: Date | null;
  stamps: StampsConfig;
  /** Discount stacking policy for the register checkout money engine. */
  stacking: StackingPolicy;
}

/**
 * Org stamps config. `goal` resolves from the linked card reward's
 * `stampsRequired` (the single source of truth); a missing/unpublished link
 * falls back to the pilot default so the card never breaks.
 */
export interface StampsConfig {
  goal: number;
  /** The linked reward when the link is healthy (published, stamps-priced). */
  cardRewardId: string | null;
  purchasesPerStamp: number;
  minAmount: Record<string, number> | null;
  categoryIds: string[] | null;
  cardTemplate: string;
  style: StampStyle | null;
  copy: StampCardCopy | null;
}

/** Pre-config pilot goal, kept as the fallback when no reward is linked. */
export const DEFAULT_STAMPS_GOAL = 9;

/** The pre-config hardcoded rate (100 COP → 4 pts), kept as the seed default. */
export const DEFAULT_POINTS_RATE: PointsRate = { per: 100, points: 4 };

export const earnsPoints = (mode: LoyaltyMode): boolean => mode !== "stamps";
export const earnsStamps = (mode: LoyaltyMode): boolean => mode !== "points";

/** The earn rule for a purchase's currency, falling back to any configured
 *  rate (an unrated currency shouldn't zero the earn — it means the org never
 *  saved config for it, not that it's worthless). */
export function rateForCurrency(cfg: LoyaltyConfig, currency: string): PointsRate {
  return (
    cfg.pointsRates[currency] ?? Object.values(cfg.pointsRates)[0] ?? DEFAULT_POINTS_RATE
  );
}

const loyaltyKey = (orgId: string) => `org-loyalty:${orgId}`;

export function getLoyaltyConfig(db: typeof Db, orgId: string): Promise<LoyaltyConfig> {
  return cache.getOrSet(
    loyaltyKey(orgId),
    async () => {
      const [row] = await db
        .select({
          settings: organizationSettings,
          cardRewardStatus: reward.status,
          cardRewardStamps: reward.stampsRequired,
        })
        .from(organizationSettings)
        .leftJoin(reward, eq(reward.id, organizationSettings.stampsCardRewardId))
        .where(eq(organizationSettings.organizationId, orgId))
        .limit(1);
      const s = row?.settings;
      const defaultCurrency = s?.defaultCurrency ?? "COP";
      // The link is healthy only while the reward stays published and priced
      // in stamps; otherwise fall back so the card keeps working.
      const linkedGoal =
        row?.cardRewardStatus === "published" && row.cardRewardStamps != null
          ? row.cardRewardStamps
          : null;
      return {
        mode: s?.loyaltyMode ?? "both",
        pointsRates: s?.pointsRates ?? { [defaultCurrency]: DEFAULT_POINTS_RATE },
        pointsCardTemplate: s?.pointsCardTemplate ?? "classic",
        tierGraceUntil: s?.tierGraceUntil ?? null,
        stamps: {
          goal: linkedGoal ?? DEFAULT_STAMPS_GOAL,
          cardRewardId: linkedGoal != null ? (s?.stampsCardRewardId ?? null) : null,
          purchasesPerStamp: s?.purchasesPerStamp ?? 1,
          minAmount: s?.stampMinAmount ?? null,
          categoryIds: s?.stampCategoryIds ?? null,
          cardTemplate: s?.stampsCardTemplate ?? "classic",
          style: s?.stampStyle ?? null,
          copy: s?.stampsCardCopy ?? null,
        },
        stacking: {
          tierStacksWithPromo: s?.tierStacksWithPromo ?? true,
          rewardStacksWithPromo: s?.rewardStacksWithPromo ?? true,
          maxTotalDiscountPct: s?.maxTotalDiscountPct ?? 100,
        },
      };
    },
    TTL_SECONDS,
  );
}

export async function invalidateLoyaltyConfig(orgId: string): Promise<void> {
  await cache.delete(loyaltyKey(orgId));
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

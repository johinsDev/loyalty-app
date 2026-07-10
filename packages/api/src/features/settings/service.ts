import type { db as Db } from "@loyalty/db";

import {
  getBranding,
  getLocalization,
  invalidateBranding,
  invalidateLocalization,
} from "../_shared/localize";
import type { SettingsRepository } from "./repository";
import { TRPCError } from "@trpc/server";

import type {
  BrandingView,
  LocalizationView,
  OnboardingAdminStep,
  OnboardingStepView,
  SetLoyaltyScopeInput,
  SmartDeliveryView,
  UpdateBrandingInput,
  UpdateLocalizationInput,
  UpdateOnboardingInput,
  UpdateSeoInput,
  UpdateSmartDeliveryInput,
} from "./schemas";

/** "" → null, undefined → undefined (skip). Keeps cleared fields nullable. */
function nullable(v: string | undefined): string | null | undefined {
  return v === undefined ? undefined : v === "" ? null : v;
}

/**
 * Org settings business logic: localization (locale/currency) + branding (name/
 * logo/color/social/T&C), SEO, and the loyalty wallet scope. Reads go through the
 * cached `getLocalization` / `getBranding` helpers (shared with the apps' SSR +
 * content features); writes upsert + invalidate.
 */
export class SettingsService {
  constructor(
    private readonly db: typeof Db,
    private readonly repo: SettingsRepository,
  ) {}

  localization(orgId: string): Promise<LocalizationView> {
    return getLocalization(this.db, orgId);
  }

  async updateLocalization(
    orgId: string,
    input: UpdateLocalizationInput,
  ): Promise<LocalizationView> {
    const row = await this.repo.upsertLocalization(orgId, input);
    await invalidateLocalization(orgId);
    return {
      defaultLocale: row.defaultLocale,
      enabledLocales: row.enabledLocales,
      defaultCurrency: row.defaultCurrency,
      enabledCurrencies: row.enabledCurrencies,
    };
  }

  // ── Branding ────────────────────────────────────────────────────────────────
  branding(orgId: string): Promise<BrandingView> {
    return getBranding(this.db, orgId);
  }

  async updateBranding(orgId: string, input: UpdateBrandingInput): Promise<BrandingView> {
    await this.repo.updateOrg(orgId, {
      name: input.name,
      logo: nullable(input.logoUrl),
    });
    await this.repo.upsertSettings(orgId, {
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.brandColor !== undefined ? { brandColor: nullable(input.brandColor) } : {}),
      ...(input.socialLinks !== undefined ? { socialLinks: input.socialLinks } : {}),
      ...(input.termsPdfUrl !== undefined ? { termsPdfUrl: nullable(input.termsPdfUrl) } : {}),
      ...(input.phone !== undefined ? { phone: nullable(input.phone) } : {}),
      ...(input.defaultHours !== undefined ? { defaultHours: input.defaultHours } : {}),
    });
    await invalidateBranding(orgId);
    return getBranding(this.db, orgId);
  }

  async updateSeo(orgId: string, input: UpdateSeoInput): Promise<BrandingView> {
    await this.repo.upsertSettings(orgId, {
      ...(input.seoTitle !== undefined ? { seoTitle: input.seoTitle } : {}),
      ...(input.seoDescription !== undefined ? { seoDescription: input.seoDescription } : {}),
      ...(input.seoKeywords !== undefined ? { seoKeywords: input.seoKeywords } : {}),
      ...(input.ogImageUrl !== undefined ? { ogImageUrl: nullable(input.ogImageUrl) } : {}),
      ...(input.faviconUrl !== undefined ? { faviconUrl: nullable(input.faviconUrl) } : {}),
    });
    await invalidateBranding(orgId);
    return getBranding(this.db, orgId);
  }

  async setLoyaltyScope(orgId: string, input: SetLoyaltyScopeInput): Promise<BrandingView> {
    await this.repo.upsertSettings(orgId, { loyaltyScope: input.loyaltyScope });
    await invalidateBranding(orgId);
    return getBranding(this.db, orgId);
  }

  // ── Smart Delivery (campaign global rules) ────────────────────────────────
  async smartDelivery(orgId: string): Promise<SmartDeliveryView> {
    const row = await this.repo.get(orgId);
    const r = row?.smartDelivery;
    return {
      frequencyCapPerWeek: r?.frequencyCapPerWeek ?? null,
      quietHoursStart: r?.quietHoursStart ?? null,
      quietHoursEnd: r?.quietHoursEnd ?? null,
    };
  }

  async updateSmartDelivery(
    orgId: string,
    input: UpdateSmartDeliveryInput,
  ): Promise<SmartDeliveryView> {
    await this.repo.upsertSettings(orgId, { smartDelivery: input });
    return this.smartDelivery(orgId);
  }

  // ── Onboarding (customer PWA first-run carousel) ──────────────────────────
  /** Every step with all locales — for the admin editor. */
  async onboardingAdmin(orgId: string): Promise<OnboardingAdminStep[]> {
    const row = await this.repo.get(orgId);
    return (row?.onboarding ?? []).map((s) => ({
      id: s.id,
      icon: s.icon,
      backgroundCss: s.backgroundCss,
      text: s.text,
    }));
  }

  /** Steps resolved to `locale`, falling back to the org default per field —
   *  for the customer app. Empty array when unconfigured (app shows its own
   *  built-in default). */
  async onboarding(orgId: string, locale: string): Promise<OnboardingStepView[]> {
    const [row, loc] = await Promise.all([
      this.repo.get(orgId),
      getLocalization(this.db, orgId),
    ]);
    const steps = row?.onboarding ?? [];
    return steps.map((s) => {
      const t = s.text[locale] ?? s.text[loc.defaultLocale] ?? { title: "", body: "" };
      const fallback = s.text[loc.defaultLocale];
      return {
        id: s.id,
        icon: s.icon,
        backgroundCss: s.backgroundCss,
        title: t.title || fallback?.title || "",
        body: t.body || fallback?.body || "",
      };
    });
  }

  async updateOnboarding(
    orgId: string,
    input: UpdateOnboardingInput,
  ): Promise<OnboardingAdminStep[]> {
    const loc = await getLocalization(this.db, orgId);
    // Every step must carry a title in the org's default locale — that's the
    // fallback the customer read relies on; without it a step renders blank.
    // `input.text` keys are the locale enum; index by the (string) default
    // locale through a widened view.
    const titleIn = (text: UpdateOnboardingInput["steps"][number]["text"], locale: string) =>
      (text as Record<string, { title: string; body: string }>)[locale]?.title;
    const missing = input.steps.findIndex((s) => !titleIn(s.text, loc.defaultLocale)?.trim());
    if (missing !== -1) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `ONBOARDING_DEFAULT_TITLE_REQUIRED:${missing}`,
      });
    }
    await this.repo.upsertSettings(orgId, { onboarding: input.steps });
    return this.onboardingAdmin(orgId);
  }
}

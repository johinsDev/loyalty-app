import type { db as Db } from "@loyalty/db";

import {
  getBranding,
  getLocalization,
  invalidateBranding,
  invalidateLocalization,
} from "../_shared/localize";
import type { SettingsRepository } from "./repository";
import type {
  BrandingView,
  LocalizationView,
  SetLoyaltyScopeInput,
  UpdateBrandingInput,
  UpdateLocalizationInput,
  UpdateSeoInput,
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
    });
    await invalidateBranding(orgId);
    return getBranding(this.db, orgId);
  }

  async setLoyaltyScope(orgId: string, input: SetLoyaltyScopeInput): Promise<BrandingView> {
    await this.repo.upsertSettings(orgId, { loyaltyScope: input.loyaltyScope });
    await invalidateBranding(orgId);
    return getBranding(this.db, orgId);
  }
}

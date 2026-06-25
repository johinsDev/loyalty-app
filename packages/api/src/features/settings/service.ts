import type { db as Db } from "@loyalty/db";

import { getLocalization, invalidateLocalization } from "../_shared/localize";
import type { SettingsRepository } from "./repository";
import type { LocalizationView, UpdateLocalizationInput } from "./schemas";

/**
 * Org settings business logic. v1 owns the localization config (default +
 * enabled locales/currencies). Reads go through the cached `getLocalization`
 * helper (shared with the content features); writes upsert + invalidate.
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
}

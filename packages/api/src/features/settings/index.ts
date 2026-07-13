export { settingsRouter } from "./router";
// Loyalty earn config — re-exported here (settings own it) so packages/jobs
// can read it without an export entry for _shared.
export {
  earnsPoints,
  earnsStamps,
  getLoyaltyConfig,
  rateForCurrency,
  type LoyaltyConfig,
} from "../_shared/localize";
export { type LoyaltyModeChange } from "./service";
export { SettingsRepository } from "./repository";
export { SettingsService } from "./service";
export {
  currencySchema,
  localeSchema,
  loyaltyScopeSchema,
  setLoyaltyScopeInputSchema,
  socialLinksSchema,
  updateBrandingInputSchema,
  updateLocalizationInputSchema,
  updateSeoInputSchema,
  type BrandingView,
  type LocalizationView,
  type SetLoyaltyScopeInput,
  type UpdateBrandingInput,
  type UpdateLocalizationInput,
  type UpdateSeoInput,
} from "./schemas";

import { type db as Db } from "@loyalty/db";

import { loadLocaleContext } from "../_shared/localize";
import { cachedRead, managerProcedure, orgId, publicProcedure, requireOrg, router } from "../../trpc";
import { SettingsRepository } from "./repository";
import {
  setLoyaltyScopeInputSchema,
  stackingPolicySchema,
  updateBrandingInputSchema,
  updateLocalizationInputSchema,
  updateLoyaltyConfigInputSchema,
  updateOnboardingInputSchema,
  updateSeoInputSchema,
  updateSmartDeliveryInputSchema,
  updateStampsConfigInputSchema,
} from "./schemas";
import { SettingsService } from "./service";

function makeService(db: typeof Db): SettingsService {
  return new SettingsService(db, new SettingsRepository(db));
}

/**
 * Org settings. `localization` + `branding` are public (the customer app reads
 * them to gate the locale/currency switchers and to theme + show the store
 * profile); editing requires a manager.
 */
export const settingsRouter = router({
  localization: publicProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).localization(orgId(ctx)),
  ),
  updateLocalization: managerProcedure
    .input(updateLocalizationInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateLocalization(requireOrg(ctx), input),
    ),

  branding: publicProcedure.query(async ({ ctx }) => {
    const org = orgId(ctx);
    // Hit on every admin page (root layout theme + [locale] metadata favicon).
    return cachedRead(ctx, `settings:branding:${org}`, 60, () =>
      makeService(ctx.db).branding(org),
    );
  }),
  updateBranding: managerProcedure
    .input(updateBrandingInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateBranding(requireOrg(ctx), input),
    ),
  updateSeo: managerProcedure
    .input(updateSeoInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateSeo(requireOrg(ctx), input),
    ),
  setLoyaltyScope: managerProcedure
    .input(setLoyaltyScopeInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).setLoyaltyScope(requireOrg(ctx), input),
    ),

  smartDelivery: managerProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).smartDelivery(requireOrg(ctx)),
  ),
  updateSmartDelivery: managerProcedure
    .input(updateSmartDeliveryInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateSmartDelivery(requireOrg(ctx), input),
    ),

  // ── Onboarding ────────────────────────────────────────────────────────────
  /** Customer PWA carousel, resolved to the visitor's locale. Public — the
   *  sign-in screen reads it before auth. */
  onboarding: publicProcedure.query(async ({ ctx }) => {
    const id = orgId(ctx);
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return makeService(ctx.db).onboarding(id, lc.locale);
  }),
  /** All steps with every locale — for the admin editor. */
  onboardingAdmin: managerProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).onboardingAdmin(requireOrg(ctx)),
  ),
  updateOnboarding: managerProcedure
    .input(updateOnboardingInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateOnboarding(requireOrg(ctx), input),
    ),

  // ── Loyalty earn config ─────────────────────────────────────────────────────
  /** Mode + card templates + locale-resolved stamp card copy/prize for the PW   *  (public, read pre-render). Rates are not exposed here — they're a business
   *  decision, not customer data. */
  loyaltyConfig: publicProcedure.query(async ({ ctx }) => {
    const id = orgId(ctx);
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return makeService(ctx.db).loyaltyConfig(id, lc);
  }),
  loyaltyConfigAdmin: managerProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).loyaltyConfigAdmin(requireOrg(ctx)),
  ),
  updateLoyaltyConfig: managerProcedure
    .input(updateLoyaltyConfigInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateLoyaltyConfig(requireOrg(ctx), input),
    ),
  updateStackingPolicy: managerProcedure
    .input(stackingPolicySchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateStackingPolicy(requireOrg(ctx), input),
    ),
  /** Static inputs for the equivalence panel (avg ticket, rewards, promos). */
  loyaltyInsights: managerProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).loyaltyInsights(requireOrg(ctx)),
  ),

  // ── Stamps config ───────────────────────────────────────────────────────────
  stampsConfigAdmin: managerProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).stampsConfigAdmin(requireOrg(ctx)),
  ),
  updateStampsConfig: managerProcedure
    .input(updateStampsConfigInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateStampsConfig(requireOrg(ctx), input),
    ),
});

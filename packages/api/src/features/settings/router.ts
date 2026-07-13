import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";

import { loadLocaleContext } from "../_shared/localize";
import { managerProcedure, publicProcedure, router } from "../../trpc";
import { SettingsRepository } from "./repository";
import {
  setLoyaltyScopeInputSchema,
  updateBrandingInputSchema,
  updateLocalizationInputSchema,
  updateLoyaltyConfigInputSchema,
  updateOnboardingInputSchema,
  updateSeoInputSchema,
  updateSmartDeliveryInputSchema,
} from "./schemas";
import { SettingsService } from "./service";

function makeService(db: typeof Db): SettingsService {
  return new SettingsService(db, new SettingsRepository(db));
}

const orgId = async (): Promise<string> => (await getPrimaryOrganizationId()) ?? "";

async function requireOrg(): Promise<string> {
  const id = await getPrimaryOrganizationId();
  if (!id) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active organization" });
  return id;
}

/**
 * Org settings. `localization` + `branding` are public (the customer app reads
 * them to gate the locale/currency switchers and to theme + show the store
 * profile); editing requires a manager.
 */
export const settingsRouter = router({
  localization: publicProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).localization(await orgId()),
  ),
  updateLocalization: managerProcedure
    .input(updateLocalizationInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateLocalization(await requireOrg(), input),
    ),

  branding: publicProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).branding(await orgId()),
  ),
  updateBranding: managerProcedure
    .input(updateBrandingInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateBranding(await requireOrg(), input),
    ),
  updateSeo: managerProcedure
    .input(updateSeoInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateSeo(await requireOrg(), input),
    ),
  setLoyaltyScope: managerProcedure
    .input(setLoyaltyScopeInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).setLoyaltyScope(await requireOrg(), input),
    ),

  smartDelivery: managerProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).smartDelivery(await requireOrg()),
  ),
  updateSmartDelivery: managerProcedure
    .input(updateSmartDeliveryInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateSmartDelivery(await requireOrg(), input),
    ),

  // ── Onboarding ────────────────────────────────────────────────────────────
  /** Customer PWA carousel, resolved to the visitor's locale. Public — the
   *  sign-in screen reads it before auth. */
  onboarding: publicProcedure.query(async ({ ctx }) => {
    const id = await orgId();
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return makeService(ctx.db).onboarding(id, lc.locale);
  }),
  /** All steps with every locale — for the admin editor. */
  onboardingAdmin: managerProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).onboardingAdmin(await requireOrg()),
  ),
  updateOnboarding: managerProcedure
    .input(updateOnboardingInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateOnboarding(await requireOrg(), input),
    ),

  // ── Loyalty earn config ─────────────────────────────────────────────────────
  /** Mode + card template for the PWA (public, read pre-render). Rates are not
   *  exposed here — they're a business decision, not customer data. */
  loyaltyConfig: publicProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).loyaltyConfig(await orgId()),
  ),
  loyaltyConfigAdmin: managerProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).loyaltyConfigAdmin(await requireOrg()),
  ),
  updateLoyaltyConfig: managerProcedure
    .input(updateLoyaltyConfigInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).updateLoyaltyConfig(await requireOrg(), input),
    ),
  /** Static inputs for the equivalence panel (avg ticket, rewards, promos). */
  loyaltyInsights: managerProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).loyaltyInsights(await requireOrg()),
  ),
});

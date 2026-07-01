import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";

import { managerProcedure, publicProcedure, router } from "../../trpc";
import { SettingsRepository } from "./repository";
import {
  setLoyaltyScopeInputSchema,
  updateBrandingInputSchema,
  updateLocalizationInputSchema,
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
});

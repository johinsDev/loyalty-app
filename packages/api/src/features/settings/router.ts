import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";

import { managerProcedure, publicProcedure, router } from "../../trpc";
import { SettingsRepository } from "./repository";
import { updateLocalizationInputSchema } from "./schemas";
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
 * Org settings. `localization` is public (the customer app reads it to gate the
 * locale/currency switchers); editing requires a manager.
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
});

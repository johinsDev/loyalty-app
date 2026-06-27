import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";

import { managerProcedure, publicProcedure, router } from "../../trpc";
import type { MapDeps } from "./service";
import { StoresRepository } from "./repository";
import { idInputSchema, updateStoreInputSchema } from "./schemas";
import { StoresService } from "./service";

function makeService(db: typeof Db): StoresService {
  return new StoresService(db, new StoresRepository(db));
}

const orgId = async (): Promise<string> => (await getPrimaryOrganizationId()) ?? "";
async function requireOrg(): Promise<string> {
  const id = await getPrimaryOrganizationId();
  if (!id) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active organization" });
  return id;
}

/** Static-map deps from the request ctx (default disk + server-side Maps key).
 *  The Worker registers only a `default` disk (public when R2_PUBLIC_URL is set),
 *  so we omit the name — `disk("public")` would throw "Unknown disk". */
function mapDeps(ctx: { storage?: { disk(name?: string): unknown } }): MapDeps {
  return {
    disk: ctx.storage?.disk() as MapDeps["disk"],
    mapsKey: process.env.GOOGLE_MAPS_API_KEY,
  };
}

/**
 * Stores (branches). Public reads for the customer app (published only);
 * managers do the CRUD. Setting a location regenerates the Static Maps shot.
 */
export const storesRouter = router({
  // ── Public (customer) ──────────────────────────────────────────────────────
  listPublic: publicProcedure.query(async ({ ctx }) => makeService(ctx.db).publicList(await orgId())),
  primary: publicProcedure.query(async ({ ctx }) => makeService(ctx.db).primary(await orgId())),

  // ── Admin (managers) ───────────────────────────────────────────────────────
  list: managerProcedure.query(async ({ ctx }) => makeService(ctx.db).adminList(await requireOrg())),
  get: managerProcedure
    .input(idInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).get(await requireOrg(), input.id)),
  create: managerProcedure.mutation(async ({ ctx }) =>
    makeService(ctx.db).create(await requireOrg()),
  ),
  update: managerProcedure
    .input(updateStoreInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).update(await requireOrg(), input, mapDeps(ctx)),
    ),
  publish: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).publish(await requireOrg(), input.id)),
  setPrimary: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).setPrimary(await requireOrg(), input.id)),
  remove: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).remove(await requireOrg(), input.id)),
});

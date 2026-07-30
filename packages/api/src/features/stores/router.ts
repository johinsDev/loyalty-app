import { type db as Db } from "@loyalty/db";

import { cachedRead, managerProcedure, orgId, publicProcedure, requireOrg, router, staffProcedure } from "../../trpc";
import type { MapDeps } from "./service";
import { StoresRepository } from "./repository";
import {
  bulkIdsSchema,
  bulkSetPublishedSchema,
  createStoreInputSchema,
  idInputSchema,
  storesListInputSchema,
  updateStoreInputSchema,
} from "./schemas";
import { StoresService } from "./service";

function makeService(db: typeof Db): StoresService {
  return new StoresService(db, new StoresRepository(db));
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
  listPublic: publicProcedure.query(async ({ ctx }) => makeService(ctx.db).publicList(orgId(ctx))),
  primary: publicProcedure.query(async ({ ctx }) => makeService(ctx.db).primary(orgId(ctx))),

  // ── Admin (managers) ───────────────────────────────────────────────────────
  list: managerProcedure
    .input(storesListInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).adminList(requireOrg(ctx), input)),
  switcherList: staffProcedure.query(async ({ ctx }) => {
    const org = requireOrg(ctx);
    // Hit on every admin nav (loadStoreScope resolves the [storeId] segment).
    return cachedRead(ctx, `stores:switcher:${org}`, 60, () =>
      makeService(ctx.db).switcherList(org),
    );
  }),
  listByIds: managerProcedure
    .input(bulkIdsSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).listByIds(requireOrg(ctx), input.ids)),
  primaryRow: managerProcedure.query(async ({ ctx }) =>
    makeService(ctx.db).primaryRow(requireOrg(ctx)),
  ),
  get: managerProcedure
    .input(idInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).get(requireOrg(ctx), input.id)),
  create: managerProcedure
    .input(createStoreInputSchema.optional())
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).create(requireOrg(ctx), input?.name),
    ),
  update: managerProcedure
    .input(updateStoreInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).update(requireOrg(ctx), input, mapDeps(ctx)),
    ),
  publish: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).publish(requireOrg(ctx), input.id)),
  setPrimary: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).setPrimary(requireOrg(ctx), input.id)),
  remove: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).remove(requireOrg(ctx), input.id)),
  bulkRemove: managerProcedure
    .input(bulkIdsSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).bulkRemove(requireOrg(ctx), input.ids)),
  bulkSetPublished: managerProcedure
    .input(bulkSetPublishedSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).bulkSetPublished(requireOrg(ctx), input.ids, input.isPublished),
    ),
});

import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";

import { loadLocaleContext } from "../_shared/localize";
import { managerProcedure, publicProcedure, router, staffProcedure } from "../../trpc";
import { BannersRepository } from "./repository";
import {
  advanceInputSchema,
  bannersListInputSchema,
  bannerStatsInputSchema,
  bulkIdsSchema,
  getStateInputSchema,
  homeBannersInputSchema,
  listInputSchema,
  publishInputSchema,
  recordStatInputSchema,
  removeInputSchema,
  reorderInputSchema,
  slugAvailableInputSchema,
  slugInputSchema,
} from "./schemas";
import { BannersService } from "./service";

function makeService(db: typeof Db): BannersService {
  return new BannersService(db, new BannersRepository(db));
}

const orgId = async (): Promise<string> => (await getPrimaryOrganizationId()) ?? "";

async function requireOrg(): Promise<string> {
  const organizationId = await getPrimaryOrganizationId();
  if (!organizationId) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active organization" });
  }
  return organizationId;
}

/**
 * Banners. Public cached reads (gated by the page guard in v1, public-ready) +
 * a server-driven manager wizard (create → getState → advance per step →
 * publish).
 */
export const bannersRouter = router({
  // ── Public (cacheable) ─────────────────────────────────────────────────────
  homeBanners: publicProcedure
    .input(homeBannersInputSchema)
    .query(async ({ ctx, input }) => {
      const id = await orgId();
      const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
      return makeService(ctx.db).homeBanners(id, lc, input.storeId);
    }),
  // Cashier catalog — published banners with store scope + display state (staff).
  staffCatalog: staffProcedure.query(async ({ ctx }) => {
    const id = await orgId();
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return new BannersRepository(ctx.db).staffCatalog(id, lc);
  }),
  bySlug: publicProcedure
    .input(slugInputSchema)
    .query(async ({ ctx, input }) => {
      const id = await orgId();
      const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
      return makeService(ctx.db).bannerBySlug(id, input.slug, lc);
    }),

  // ── CTR ingest (called by the customer web app) ────────────────────────────
  recordImpression: publicProcedure
    .input(recordStatInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).recordImpression(await orgId(), input.id),
    ),
  recordClick: publicProcedure
    .input(recordStatInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).recordClick(await orgId(), input.id),
    ),

  // ── Admin wizard (managers + owners) ───────────────────────────────────────
  create: managerProcedure.mutation(async ({ ctx }) =>
    makeService(ctx.db).create(await requireOrg()),
  ),
  getState: managerProcedure
    .input(getStateInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).getState(await requireOrg(), input.id),
    ),
  advance: managerProcedure
    .input(advanceInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).advance(
        await requireOrg(),
        ctx.session.user.id,
        input.id,
        input.step,
        input.input,
      ),
    ),
  publish: managerProcedure
    .input(publishInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).publish(await requireOrg(), input.id),
    ),
  list: managerProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).list(await requireOrg(), input),
    ),
  adminList: managerProcedure
    .input(bannersListInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).adminList(await requireOrg(), input),
    ),
  listByIds: managerProcedure
    .input(bulkIdsSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).listByIds(await requireOrg(), input.ids),
    ),
  detail: managerProcedure
    .input(getStateInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).detail(await requireOrg(), input.id),
    ),
  stats: managerProcedure
    .input(bannerStatsInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).stats(await requireOrg(), input.bannerId, input.from, input.to),
    ),
  analytics: managerProcedure
    .input(bannerStatsInputSchema.pick({ from: true }).partial())
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).orgAnalytics(await requireOrg(), input.from),
    ),
  bulkRemove: managerProcedure
    .input(bulkIdsSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).bulkRemove(await requireOrg(), input.ids),
    ),
  remove: managerProcedure
    .input(removeInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).remove(await requireOrg(), input.id),
    ),
  reorder: managerProcedure
    .input(reorderInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).reorder(await requireOrg(), input.ids),
    ),
  slugAvailable: managerProcedure
    .input(slugAvailableInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).slugAvailable(await requireOrg(), input.slug, input.excludeId),
    ),
});

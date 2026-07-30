import { type db as Db } from "@loyalty/db";

import { loadLocaleContext } from "../_shared/localize";
import { cachedListRead } from "../_shared/list-cache";
import { managerProcedure, orgId, publicProcedure, requireOrg, router, staffProcedure } from "../../trpc";
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
      const id = orgId(ctx);
      const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
      return makeService(ctx.db).homeBanners(id, lc, input.storeId);
    }),
  // Cashier catalog — published banners with store scope + display state (staff).
  staffCatalog: staffProcedure.query(async ({ ctx }) => {
    const id = orgId(ctx);
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return new BannersRepository(ctx.db).staffCatalog(id, lc);
  }),
  bySlug: publicProcedure
    .input(slugInputSchema)
    .query(async ({ ctx, input }) => {
      const id = orgId(ctx);
      const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
      return makeService(ctx.db).bannerBySlug(id, input.slug, lc);
    }),

  // ── CTR ingest (called by the customer web app) ────────────────────────────
  recordImpression: publicProcedure
    .input(recordStatInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).recordImpression(orgId(ctx), input.id),
    ),
  recordClick: publicProcedure
    .input(recordStatInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).recordClick(orgId(ctx), input.id),
    ),

  // ── Admin wizard (managers + owners) ───────────────────────────────────────
  create: managerProcedure.mutation(async ({ ctx }) =>
    makeService(ctx.db).create(requireOrg(ctx)),
  ),
  getState: managerProcedure
    .input(getStateInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).getState(requireOrg(ctx), input.id),
    ),
  advance: managerProcedure
    .input(advanceInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).advance(
        requireOrg(ctx),
        ctx.session.user.id,
        input.id,
        input.step,
        input.input,
      ),
    ),
  publish: managerProcedure
    .input(publishInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).publish(requireOrg(ctx), input.id),
    ),
  list: managerProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).list(requireOrg(ctx), input),
    ),
  adminList: managerProcedure
    .input(bannersListInputSchema)
    .query(async ({ ctx, input }) => {
      const org = requireOrg(ctx);
      return cachedListRead(ctx, "banners", org, input, () =>
        makeService(ctx.db).adminList(org, input),
      );
    }),
  listByIds: managerProcedure
    .input(bulkIdsSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).listByIds(requireOrg(ctx), input.ids),
    ),
  detail: managerProcedure
    .input(getStateInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).detail(requireOrg(ctx), input.id),
    ),
  stats: managerProcedure
    .input(bannerStatsInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).stats(requireOrg(ctx), input.bannerId, input.from, input.to),
    ),
  analytics: managerProcedure
    .input(bannerStatsInputSchema.pick({ from: true }).partial())
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).orgAnalytics(requireOrg(ctx), input.from),
    ),
  bulkRemove: managerProcedure
    .input(bulkIdsSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).bulkRemove(requireOrg(ctx), input.ids),
    ),
  remove: managerProcedure
    .input(removeInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).remove(requireOrg(ctx), input.id),
    ),
  reorder: managerProcedure
    .input(reorderInputSchema)
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).reorder(requireOrg(ctx), input.ids),
    ),
  slugAvailable: managerProcedure
    .input(slugAvailableInputSchema)
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).slugAvailable(requireOrg(ctx), input.slug, input.excludeId),
    ),
});

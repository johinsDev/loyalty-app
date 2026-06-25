import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";

import { loadLocaleContext } from "../_shared/localize";
import {
  protectedProcedure,
  publicProcedure,
  rateLimit,
  router,
} from "../../trpc";
import { ProductsRepository } from "./repository";
import {
  listInputSchema,
  placementInputSchema,
  productIdInputSchema,
  slugInputSchema,
} from "./schemas";
import { MenuService } from "./service";

const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

export function buildMenuService(ctx: { db: typeof Db }): MenuService {
  return new MenuService(new ProductsRepository(ctx.db));
}

export const menuRouter = router({
  // ---- Public (cacheable) — gated by the page guard in v1, ready for public --
  list: publicProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) => {
      const id = await orgId();
      const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
      return buildMenuService(ctx).list(id, input, lc);
    }),

  productBySlug: publicProcedure
    .input(slugInputSchema)
    .query(async ({ ctx, input }) => {
      const id = await orgId();
      const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
      return buildMenuService(ctx).productBySlug(id, input.slug, lc);
    }),

  sections: publicProcedure
    .input(placementInputSchema)
    .query(async ({ ctx, input }) => {
      const id = await orgId();
      const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
      return buildMenuService(ctx).sections(id, input.placement, lc);
    }),

  categories: publicProcedure.query(async ({ ctx }) => {
    const id = await orgId();
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return buildMenuService(ctx).categories(id, lc);
  }),

  // ---- Per-user favorites --------------------------------------------------
  myFavoriteIds: protectedProcedure.query(async ({ ctx }) =>
    buildMenuService(ctx).myFavoriteIds(await orgId(), ctx.session.user.id),
  ),

  myFavorites: protectedProcedure.query(async ({ ctx }) => {
    const id = await orgId();
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return buildMenuService(ctx).myFavorites(id, ctx.session.user.id, lc);
  }),

  toggleFavorite: protectedProcedure
    .use(rateLimit({ name: "menu.toggleFavorite", limit: 60, window: "1m", by: "user" }))
    .input(productIdInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildMenuService(ctx).toggleFavorite(
        await orgId(),
        ctx.session.user.id,
        input.productId,
      ),
    ),
});

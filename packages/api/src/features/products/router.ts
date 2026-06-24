import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";

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
    .query(async ({ ctx, input }) =>
      buildMenuService(ctx).list(await orgId(), input),
    ),

  productBySlug: publicProcedure
    .input(slugInputSchema)
    .query(async ({ ctx, input }) =>
      buildMenuService(ctx).productBySlug(await orgId(), input.slug),
    ),

  sections: publicProcedure
    .input(placementInputSchema)
    .query(async ({ ctx, input }) =>
      buildMenuService(ctx).sections(await orgId(), input.placement),
    ),

  categories: publicProcedure.query(async ({ ctx }) =>
    buildMenuService(ctx).categories(await orgId()),
  ),

  // ---- Per-user favorites --------------------------------------------------
  myFavoriteIds: protectedProcedure.query(async ({ ctx }) =>
    buildMenuService(ctx).myFavoriteIds(await orgId(), ctx.session.user.id),
  ),

  myFavorites: protectedProcedure.query(async ({ ctx }) =>
    buildMenuService(ctx).myFavorites(await orgId(), ctx.session.user.id),
  ),

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

import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";

import { z } from "zod";

import { loadLocaleContext } from "../_shared/localize";
import {
  managerProcedure,
  protectedProcedure,
  publicProcedure,
  rateLimit,
  router,
} from "../../trpc";
import { ProductsAdminRepository } from "./admin-repository";
import { IngredientsRepository } from "./ingredients-repository";
import { ProductsRepository } from "./repository";
import {
  listInputSchema,
  placementInputSchema,
  productIdInputSchema,
  slugInputSchema,
} from "./schemas";
import { MenuService } from "./service";
import {
  ingredientCreateSchema,
  ingredientListInputSchema,
  ingredientUpdateSchema,
  productAdminListInputSchema,
  productStatusSchema,
  productUpsertInputSchema,
} from "./write-schemas";

const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

export function buildMenuService(ctx: { db: typeof Db }): MenuService {
  return new MenuService(new ProductsRepository(ctx.db));
}

const idInput = z.object({ id: z.string().min(1) });

export const menuRouter = router({
  // ---- Admin CRUD (manager) -------------------------------------------------
  createDraft: managerProcedure.mutation(async ({ ctx }) =>
    new ProductsAdminRepository(ctx.db).createDraft(await orgId()),
  ),
  getAdmin: managerProcedure
    .input(idInput)
    .query(async ({ ctx, input }) =>
      new ProductsAdminRepository(ctx.db).getAdmin(await orgId(), input.id),
    ),
  upsert: managerProcedure
    .input(productUpsertInputSchema)
    .mutation(async ({ ctx, input }) =>
      new ProductsAdminRepository(ctx.db).upsert(await orgId(), input),
    ),
  setStatus: managerProcedure
    .input(z.object({ id: z.string().min(1), status: productStatusSchema }))
    .mutation(async ({ ctx, input }) =>
      new ProductsAdminRepository(ctx.db).setStatus(await orgId(), input.id, input.status),
    ),
  remove: managerProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) =>
      new ProductsAdminRepository(ctx.db).remove(await orgId(), input.id),
    ),
  adminList: managerProcedure
    .input(productAdminListInputSchema)
    .query(async ({ ctx, input }) =>
      new ProductsAdminRepository(ctx.db).adminList(await orgId(), input),
    ),

  // ---- Ingredient catalog (manager) ----------------------------------------
  ingredients: managerProcedure
    .input(ingredientListInputSchema)
    .query(async ({ ctx, input }) =>
      new IngredientsRepository(ctx.db).list(await orgId(), input.search),
    ),
  ingredientCreate: managerProcedure
    .input(ingredientCreateSchema)
    .mutation(async ({ ctx, input }) =>
      new IngredientsRepository(ctx.db).create(await orgId(), input),
    ),
  ingredientUpdate: managerProcedure
    .input(ingredientUpdateSchema)
    .mutation(async ({ ctx, input }) =>
      new IngredientsRepository(ctx.db).update(await orgId(), input),
    ),
  ingredientRemove: managerProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) =>
      new IngredientsRepository(ctx.db).remove(await orgId(), input.id),
    ),

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

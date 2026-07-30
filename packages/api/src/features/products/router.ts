import { type db as Db } from "@loyalty/db";

import { z } from "zod";

import { loadLocaleContext } from "../_shared/localize";
import {
  managerProcedure,
  orgId,
  protectedProcedure,
  publicProcedure,
  rateLimit,
  router,
} from "../../trpc";
import { AddonsRepository } from "../addons";
import { IngredientsRepository } from "../ingredients";
import { ProductsAdminRepository } from "./admin-repository";
import { ProductsRepository } from "./repository";
import {
  listInputSchema,
  placementInputSchema,
  productIdInputSchema,
  slugInputSchema,
} from "./schemas";
import { MenuService } from "./service";
import { addonCreateSchema, addonUpdateSchema } from "../addons/schemas";
import {
  ingredientCreateSchema,
  ingredientUpdateSchema,
} from "../ingredients/schemas";
import {
  productAdminListInputSchema,
  productStatusSchema,
  productUpsertInputSchema,
} from "./write-schemas";

export function buildMenuService(ctx: { db: typeof Db }): MenuService {
  return new MenuService(new ProductsRepository(ctx.db));
}

const idInput = z.object({ id: z.string().min(1) });
const legacySearchInput = z
  .object({ search: z.string().trim().max(80).optional() })
  .default({});

export const menuRouter = router({
  // ---- Admin CRUD (manager) -------------------------------------------------
  createDraft: managerProcedure.mutation(async ({ ctx }) =>
    new ProductsAdminRepository(ctx.db).createDraft(orgId(ctx)),
  ),
  getAdmin: managerProcedure
    .input(idInput)
    .query(async ({ ctx, input }) =>
      new ProductsAdminRepository(ctx.db).getAdmin(orgId(ctx), input.id),
    ),
  upsert: managerProcedure
    .input(productUpsertInputSchema)
    .mutation(async ({ ctx, input }) =>
      new ProductsAdminRepository(ctx.db).upsert(orgId(ctx), input),
    ),
  setStatus: managerProcedure
    .input(z.object({ id: z.string().min(1), status: productStatusSchema }))
    .mutation(async ({ ctx, input }) =>
      new ProductsAdminRepository(ctx.db).setStatus(orgId(ctx), input.id, input.status),
    ),
  remove: managerProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) =>
      new ProductsAdminRepository(ctx.db).remove(orgId(ctx), input.id),
    ),
  adminList: managerProcedure
    .input(productAdminListInputSchema)
    .query(async ({ ctx, input }) =>
      new ProductsAdminRepository(ctx.db).adminList(orgId(ctx), input),
    ),

  // ---- Legacy catalog shims (manager) --------------------------------------
  // The add-on and ingredient catalogs moved to their own features
  // (`features/addons`, `features/ingredients`) with paginated, filterable
  // lists. These delegates keep the existing admin screens working while they
  // migrate to `addons.*` / `ingredients.*`; drop them once nothing calls them.
  ingredients: managerProcedure
    // `search` is accepted and ignored — callers all pass `{}` and filter
    // client-side. Kept so the legacy call sites still type-check.
    .input(legacySearchInput)
    .query(async ({ ctx }) =>
      new IngredientsRepository(ctx.db).listForPicker(orgId(ctx)),
    ),
  ingredientCreate: managerProcedure
    .input(ingredientCreateSchema)
    .mutation(async ({ ctx, input }) =>
      new IngredientsRepository(ctx.db).create(orgId(ctx), input),
    ),
  ingredientUpdate: managerProcedure
    .input(ingredientUpdateSchema)
    .mutation(async ({ ctx, input }) =>
      new IngredientsRepository(ctx.db).update(orgId(ctx), input),
    ),
  ingredientRemove: managerProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) =>
      new IngredientsRepository(ctx.db).remove(orgId(ctx), input.id),
    ),

  addons: managerProcedure.input(legacySearchInput).query(async ({ ctx }) => {
    const res = await new AddonsRepository(ctx.db).list(orgId(ctx), {
      q: undefined,
      page: 1,
      perPage: 100,
      sort: [],
      categoryId: [],
      active: [],
      linked: [],
    });
    return res.rows;
  }),
  addonCreate: managerProcedure
    .input(addonCreateSchema)
    .mutation(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).create(orgId(ctx), input),
    ),
  addonUpdate: managerProcedure
    .input(addonUpdateSchema)
    .mutation(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).update(orgId(ctx), input),
    ),
  addonRemove: managerProcedure
    .input(idInput)
    .mutation(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).remove(orgId(ctx), input.id),
    ),

  // ---- Public (cacheable) — gated by the page guard in v1, ready for public --
  list: publicProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) => {
      const id = orgId(ctx);
      const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
      return buildMenuService(ctx).list(id, input, lc);
    }),

  productBySlug: publicProcedure
    .input(slugInputSchema)
    .query(async ({ ctx, input }) => {
      const id = orgId(ctx);
      const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
      return buildMenuService(ctx).productBySlug(id, input.slug, lc);
    }),

  sections: publicProcedure
    .input(placementInputSchema)
    .query(async ({ ctx, input }) => {
      const id = orgId(ctx);
      const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
      return buildMenuService(ctx).sections(id, input.placement, lc, input.storeId);
    }),

  categories: publicProcedure.query(async ({ ctx }) => {
    const id = orgId(ctx);
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return buildMenuService(ctx).categories(id, lc);
  }),

  /** Roots with their sub-categories — the customer menu's two-row chip strip. */
  categoryTree: publicProcedure.query(async ({ ctx }) => {
    const id = orgId(ctx);
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return buildMenuService(ctx).categoryTree(id, lc);
  }),

  // ---- Per-user favorites --------------------------------------------------
  myFavoriteIds: protectedProcedure.query(async ({ ctx }) =>
    buildMenuService(ctx).myFavoriteIds(orgId(ctx), ctx.session.user.id),
  ),

  myFavorites: protectedProcedure.query(async ({ ctx }) => {
    const id = orgId(ctx);
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return buildMenuService(ctx).myFavorites(id, ctx.session.user.id, lc);
  }),

  toggleFavorite: protectedProcedure
    .use(rateLimit({ name: "menu.toggleFavorite", limit: 60, window: "1m", by: "user" }))
    .input(productIdInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildMenuService(ctx).toggleFavorite(
        orgId(ctx),
        ctx.session.user.id,
        input.productId,
      ),
    ),
});

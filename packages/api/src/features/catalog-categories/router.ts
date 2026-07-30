
import { managerProcedure, orgId, router } from "../../trpc";
import { CatalogCategoriesRepository } from "./repository";
import {
  catalogCategoryCreateSchema,
  catalogCategoryIdSchema,
  catalogCategoryListInputSchema,
  catalogCategoryUpdateSchema,
} from "./schemas";


/**
 * Supply-catalog taxonomy (add-ons + ingredients). Manager-only: it shapes what
 * the register offers, and an add-on category is live — editing it changes every
 * product whose group resolves through it.
 */
export const catalogCategoriesRouter = router({
  list: managerProcedure
    .input(catalogCategoryListInputSchema)
    .query(async ({ ctx, input }) =>
      new CatalogCategoriesRepository(ctx.db).list(orgId(ctx), input.kind),
    ),
  create: managerProcedure
    .input(catalogCategoryCreateSchema)
    .mutation(async ({ ctx, input }) =>
      new CatalogCategoriesRepository(ctx.db).create(orgId(ctx), input),
    ),
  update: managerProcedure
    .input(catalogCategoryUpdateSchema)
    .mutation(async ({ ctx, input }) =>
      new CatalogCategoriesRepository(ctx.db).update(orgId(ctx), input),
    ),
  remove: managerProcedure
    .input(catalogCategoryIdSchema)
    .mutation(async ({ ctx, input }) =>
      new CatalogCategoriesRepository(ctx.db).remove(orgId(ctx), input.id),
    ),
});

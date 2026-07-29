import { getPrimaryOrganizationId } from "@loyalty/db";

import { managerProcedure, router } from "../../trpc";
import { CatalogCategoriesRepository } from "./repository";
import {
  catalogCategoryCreateSchema,
  catalogCategoryIdSchema,
  catalogCategoryListInputSchema,
  catalogCategoryUpdateSchema,
} from "./schemas";

const orgId = async (): Promise<string> => (await getPrimaryOrganizationId()) ?? "";

/**
 * Supply-catalog taxonomy (add-ons + ingredients). Manager-only: it shapes what
 * the register offers, and an add-on category is live — editing it changes every
 * product whose group resolves through it.
 */
export const catalogCategoriesRouter = router({
  list: managerProcedure
    .input(catalogCategoryListInputSchema)
    .query(async ({ ctx, input }) =>
      new CatalogCategoriesRepository(ctx.db).list(await orgId(), input.kind),
    ),
  create: managerProcedure
    .input(catalogCategoryCreateSchema)
    .mutation(async ({ ctx, input }) =>
      new CatalogCategoriesRepository(ctx.db).create(await orgId(), input),
    ),
  update: managerProcedure
    .input(catalogCategoryUpdateSchema)
    .mutation(async ({ ctx, input }) =>
      new CatalogCategoriesRepository(ctx.db).update(await orgId(), input),
    ),
  remove: managerProcedure
    .input(catalogCategoryIdSchema)
    .mutation(async ({ ctx, input }) =>
      new CatalogCategoriesRepository(ctx.db).remove(await orgId(), input.id),
    ),
});

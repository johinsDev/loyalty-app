import { getPrimaryOrganizationId } from "@loyalty/db";

import { buildMenuService } from "../products/router";
import { managerProcedure, router } from "../../trpc";
import { CategoriesRepository } from "./repository";
import {
  categoryCreateSchema,
  categoryIdSchema,
  categoryReorderSchema,
  categoryTreeInputSchema,
  categoryUpdateSchema,
} from "./schemas";

const orgId = async (): Promise<string> => (await getPrimaryOrganizationId()) ?? "";

/**
 * Category management (manager-only). The customer-facing reads stay on the
 * `menu` router; every mutation here drops the cached menu reads so the picker,
 * the products facet and the PWA see the change on their next fetch.
 */
export const categoriesRouter = router({
  tree: managerProcedure
    .input(categoryTreeInputSchema)
    .query(async ({ ctx, input }) =>
      new CategoriesRepository(ctx.db).tree(await orgId(), input),
    ),

  usage: managerProcedure
    .input(categoryIdSchema)
    .query(async ({ ctx, input }) =>
      new CategoriesRepository(ctx.db).usage(await orgId(), input.id),
    ),

  create: managerProcedure
    .input(categoryCreateSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await orgId();
      const result = await new CategoriesRepository(ctx.db).create(org, input);
      await buildMenuService(ctx).invalidate(org);
      return result;
    }),

  update: managerProcedure
    .input(categoryUpdateSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await orgId();
      const result = await new CategoriesRepository(ctx.db).update(org, input);
      await buildMenuService(ctx).invalidate(org);
      return result;
    }),

  archive: managerProcedure
    .input(categoryIdSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await orgId();
      await new CategoriesRepository(ctx.db).archive(org, input.id);
      await buildMenuService(ctx).invalidate(org);
    }),

  restore: managerProcedure
    .input(categoryIdSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await orgId();
      await new CategoriesRepository(ctx.db).restore(org, input.id);
      await buildMenuService(ctx).invalidate(org);
    }),

  reorder: managerProcedure
    .input(categoryReorderSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await orgId();
      await new CategoriesRepository(ctx.db).reorder(org, input);
      await buildMenuService(ctx).invalidate(org);
    }),
});

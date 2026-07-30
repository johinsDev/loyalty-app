import { TRPCError } from "@trpc/server";

import { managerProcedure, orgId, router } from "../../trpc";
import { IngredientsRepository } from "./repository";
import {
  ingredientArchiveSchema,
  ingredientCreateSchema,
  ingredientIdSchema,
  ingredientListInputSchema,
  ingredientUpdateSchema,
} from "./schemas";


export const ingredientsRouter = router({
  adminList: managerProcedure
    .input(ingredientListInputSchema)
    .query(async ({ ctx, input }) =>
      new IngredientsRepository(ctx.db).list(orgId(ctx), input),
    ),
  picker: managerProcedure.query(async ({ ctx }) =>
    new IngredientsRepository(ctx.db).listForPicker(orgId(ctx)),
  ),
  get: managerProcedure
    .input(ingredientIdSchema)
    .query(async ({ ctx, input }) =>
      new IngredientsRepository(ctx.db).get(orgId(ctx), input.id),
    ),
  /** Which products/variants use it + linked add-ons. Drives the detail drawer
   *  and the pre-delete confirmation. */
  usage: managerProcedure
    .input(ingredientIdSchema)
    .query(async ({ ctx, input }) =>
      new IngredientsRepository(ctx.db).usage(orgId(ctx), input.id),
    ),
  create: managerProcedure
    .input(ingredientCreateSchema)
    .mutation(async ({ ctx, input }) =>
      new IngredientsRepository(ctx.db).create(orgId(ctx), input),
    ),
  update: managerProcedure
    .input(ingredientUpdateSchema)
    .mutation(async ({ ctx, input }) =>
      new IngredientsRepository(ctx.db).update(orgId(ctx), input),
    ),
  setArchived: managerProcedure
    .input(ingredientArchiveSchema)
    .mutation(async ({ ctx, input }) =>
      new IngredientsRepository(ctx.db).setArchived(orgId(ctx), input.id, input.archived),
    ),
  /**
   * Hard delete, refused while any recipe references it. The DB would raise a
   * bare `FOREIGN KEY constraint failed`; this checks first and returns a typed
   * CONFLICT naming the products that block it, so the UI can offer archiving.
   */
  remove: managerProcedure
    .input(ingredientIdSchema)
    .mutation(async ({ ctx, input }) => {
      const repo = new IngredientsRepository(ctx.db);
      const org = orgId(ctx);
      const usage = await repo.usage(org, input.id);
      if (!usage.canDelete) {
        throw new TRPCError({
          code: "CONFLICT",
          message: usage.products.map((p) => p.productName).join(", "),
        });
      }
      await repo.remove(org, input.id);
    }),
});

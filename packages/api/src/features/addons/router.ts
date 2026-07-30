import { z } from "zod";

import { managerProcedure, orgId, router } from "../../trpc";
import { AddonsRepository } from "./repository";
import {
  addonCreateSchema,
  addonIdSchema,
  addonListInputSchema,
  addonUpdateSchema,
} from "./schemas";


export const addonsRouter = router({
  /** Paginated + filterable list backing the admin data table. */
  adminList: managerProcedure
    .input(addonListInputSchema)
    .query(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).list(orgId(ctx), input),
    ),
  /** Active add-ons for the pickers, optionally narrowed to one category. */
  picker: managerProcedure
    .input(z.object({ categoryId: z.string().min(1).nullish() }).default({}))
    .query(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).listForPicker(orgId(ctx), input.categoryId),
    ),
  get: managerProcedure
    .input(addonIdSchema)
    .query(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).get(orgId(ctx), input.id),
    ),
  create: managerProcedure
    .input(addonCreateSchema)
    .mutation(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).create(orgId(ctx), input),
    ),
  update: managerProcedure
    .input(addonUpdateSchema)
    .mutation(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).update(orgId(ctx), input),
    ),
  remove: managerProcedure
    .input(addonIdSchema)
    .mutation(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).remove(orgId(ctx), input.id),
    ),
});

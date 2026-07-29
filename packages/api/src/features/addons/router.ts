import { getPrimaryOrganizationId } from "@loyalty/db";
import { z } from "zod";

import { managerProcedure, router } from "../../trpc";
import { AddonsRepository } from "./repository";
import {
  addonCreateSchema,
  addonIdSchema,
  addonListInputSchema,
  addonUpdateSchema,
} from "./schemas";

const orgId = async (): Promise<string> => (await getPrimaryOrganizationId()) ?? "";

export const addonsRouter = router({
  /** Paginated + filterable list backing the admin data table. */
  adminList: managerProcedure
    .input(addonListInputSchema)
    .query(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).list(await orgId(), input),
    ),
  /** Active add-ons for the pickers, optionally narrowed to one category. */
  picker: managerProcedure
    .input(z.object({ categoryId: z.string().min(1).nullish() }).default({}))
    .query(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).listForPicker(await orgId(), input.categoryId),
    ),
  get: managerProcedure
    .input(addonIdSchema)
    .query(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).get(await orgId(), input.id),
    ),
  create: managerProcedure
    .input(addonCreateSchema)
    .mutation(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).create(await orgId(), input),
    ),
  update: managerProcedure
    .input(addonUpdateSchema)
    .mutation(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).update(await orgId(), input),
    ),
  remove: managerProcedure
    .input(addonIdSchema)
    .mutation(async ({ ctx, input }) =>
      new AddonsRepository(ctx.db).remove(await orgId(), input.id),
    ),
});

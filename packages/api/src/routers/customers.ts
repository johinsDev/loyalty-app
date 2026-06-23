import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { z } from "zod";

import { CustomersRepository } from "../features/customers/repository";
import { router, staffProcedure } from "../trpc";

const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

const repo = (db: typeof Db) => new CustomersRepository(db);

export const customersRouter = router({
  /** Cashier customer picker — search by name / phone / email, org-scoped. */
  search: staffProcedure
    .input(
      z.object({
        query: z.string().default(""),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) =>
      repo(ctx.db).search(await orgId(), input.query, input.limit),
    ),
});

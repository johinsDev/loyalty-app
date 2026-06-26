import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";

import { protectedProcedure, router } from "../../trpc";
import { PurchasesRepository } from "./repository";
import {
  myPurchasesInputSchema,
  purchaseIdInputSchema,
  recentPurchasesInputSchema,
  usualsInputSchema,
} from "./schemas";
import { PurchasesService } from "./service";

/** The single principal org (single-tenant pilot). */
const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

function buildService(ctx: { db: typeof Db }): PurchasesService {
  return new PurchasesService(new PurchasesRepository(ctx.db));
}

export const purchasesRouter = router({
  // ---- Customer (self) ------------------------------------------------
  myPurchases: protectedProcedure
    .input(myPurchasesInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).myPurchases(await orgId(), ctx.session.user.id, input),
    ),

  purchaseDetail: protectedProcedure
    .input(purchaseIdInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).purchaseDetail(
        await orgId(),
        ctx.session.user.id,
        input.id,
      ),
    ),

  recentPurchases: protectedProcedure
    .input(recentPurchasesInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).recentPurchases(
        await orgId(),
        ctx.session.user.id,
        input,
      ),
    ),

  usuals: protectedProcedure
    .input(usualsInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).usuals(await orgId(), ctx.session.user.id, input),
    ),
});

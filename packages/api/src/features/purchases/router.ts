import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";

import {
  managerProcedure,
  ownerProcedure,
  protectedProcedure,
  rateLimit,
  router,
} from "../../trpc";
import { buildPointsService } from "../points/router";
import { PurchasesRepository } from "./repository";
import {
  bulkIdsSchema,
  myPurchasesInputSchema,
  purchaseAdminIdSchema,
  purchaseIdInputSchema,
  purchasesAdminListInputSchema,
  recentPurchasesInputSchema,
  usualsInputSchema,
  voidPurchaseInputSchema,
} from "./schemas";
import { PurchasesService } from "./service";

/** The single principal org (single-tenant pilot). */
const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

async function requireOrg(): Promise<string> {
  const id = await getPrimaryOrganizationId();
  if (!id) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active organization" });
  }
  return id;
}

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

  // ---- Admin (managers) -----------------------------------------------
  adminList: managerProcedure
    .input(purchasesAdminListInputSchema)
    .query(async ({ ctx, input }) => buildService(ctx).adminList(await requireOrg(), input)),

  adminListByIds: managerProcedure
    .input(bulkIdsSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).listByIds(await requireOrg(), input.ids),
    ),

  adminKpis: managerProcedure
    .input(purchasesAdminListInputSchema)
    .query(async ({ ctx, input }) => buildService(ctx).adminKpis(await requireOrg(), input)),

  adminGet: managerProcedure
    .input(purchaseAdminIdSchema)
    .query(async ({ ctx, input }) => buildService(ctx).adminGet(await requireOrg(), input.id)),

  resendReceipt: managerProcedure
    .use(rateLimit({ name: "purchases.resendReceipt", limit: 20, window: "1m", by: "user" }))
    .input(purchaseAdminIdSchema)
    .mutation(async ({ ctx, input }) =>
      buildService(ctx).resendReceipt(await requireOrg(), input.id),
    ),

  voidPurchase: ownerProcedure
    .use(rateLimit({ name: "purchases.voidPurchase", limit: 20, window: "1m", by: "user" }))
    .input(voidPurchaseInputSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await requireOrg();
      return buildService(ctx).voidPurchase(org, input.id, input.reason, ctx.session.user.id, (cid) =>
        buildPointsService(ctx).recompute(org, cid, { silent: true }).then(() => undefined),
      );
    }),
});

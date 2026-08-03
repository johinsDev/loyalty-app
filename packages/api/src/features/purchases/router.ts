import { type db as Db } from "@loyalty/db";

import { managerProcedure, orgId, ownerProcedure, protectedProcedure, rateLimit, requireOrg, router, staffProcedure } from "../../trpc";
import { cachedListRead } from "../_shared/list-cache";
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
function buildService(ctx: { db: typeof Db }): PurchasesService {
  return new PurchasesService(new PurchasesRepository(ctx.db), ctx.db);
}

export const purchasesRouter = router({
  // ---- Customer (self) ------------------------------------------------
  myPurchases: protectedProcedure
    .input(myPurchasesInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).myPurchases(orgId(ctx), ctx.session.user.id, input),
    ),

  purchaseDetail: protectedProcedure
    .input(purchaseIdInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).purchaseDetail(
        orgId(ctx),
        ctx.session.user.id,
        input.id,
      ),
    ),

  recentPurchases: protectedProcedure
    .input(recentPurchasesInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).recentPurchases(
        orgId(ctx),
        ctx.session.user.id,
        input,
      ),
    ),

  usuals: protectedProcedure
    .input(usualsInputSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).usuals(orgId(ctx), ctx.session.user.id, input),
    ),

  // ---- Admin (managers) -----------------------------------------------
  adminList: managerProcedure
    .input(purchasesAdminListInputSchema)
    .query(async ({ ctx, input }) => {
      const org = requireOrg(ctx);
      return cachedListRead(ctx, "purchases", org, input, () =>
        buildService(ctx).adminList(org, input),
      );
    }),

  adminListByIds: managerProcedure
    .input(bulkIdsSchema)
    .query(async ({ ctx, input }) =>
      buildService(ctx).listByIds(requireOrg(ctx), input.ids),
    ),

  adminKpis: managerProcedure
    .input(purchasesAdminListInputSchema)
    .query(async ({ ctx, input }) => buildService(ctx).adminKpis(requireOrg(ctx), input)),

  // `staffProcedure`, not manager: the cashier needs to read back a sale they
  // just rang up — what was in it, which promo and reward applied, what the
  // customer earned. The destructive affordances (void, adjust points, resend)
  // are separate procedures and stay manager/owner, and the view hides them by
  // role. Scoped to the org, NOT to the cashier's store: ids aren't guessable
  // and the register only ever hands out ids from its own shift feed.
  adminGet: staffProcedure
    .input(purchaseAdminIdSchema)
    .query(async ({ ctx, input }) => buildService(ctx).adminGet(requireOrg(ctx), input.id)),

  resendReceipt: managerProcedure
    .use(rateLimit({ name: "purchases.resendReceipt", limit: 20, window: "1m", by: "user" }))
    .input(purchaseAdminIdSchema)
    .mutation(async ({ ctx, input }) =>
      buildService(ctx).resendReceipt(requireOrg(ctx), input.id),
    ),

  voidPurchase: ownerProcedure
    .use(rateLimit({ name: "purchases.voidPurchase", limit: 20, window: "1m", by: "user" }))
    .input(voidPurchaseInputSchema)
    .mutation(async ({ ctx, input }) => {
      const org = requireOrg(ctx);
      return buildService(ctx).voidPurchase(org, input.id, input.reason, ctx.session.user.id, (cid) =>
        buildPointsService(ctx).recompute(org, cid, { silent: true }).then(() => undefined),
      );
    }),
});

import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";

import {
  ownerProcedure,
  protectedProcedure,
  type RealtimeBinding,
  router,
  staffProcedure,
} from "../../trpc";
import { PointsRepository } from "./repository";
import {
  adjustForPurchaseInputSchema,
  customerIdInputSchema,
  historyInputSchema,
  transactionsInputSchema,
} from "./schemas";
import { PointsService } from "./service";

const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

/** Shared builder — the stamps router reuses this to earn points on a purchase. */
export function buildPointsService(ctx: {
  db: typeof Db;
  realtime?: RealtimeBinding;
}): PointsService {
  return new PointsService(new PointsRepository(ctx.db), {
    realtime: ctx.realtime,
  });
}

export const pointsRouter = router({
  // ---- Cashier / staff ------------------------------------------------
  summaryForCustomer: staffProcedure
    .input(customerIdInputSchema)
    .query(async ({ ctx, input }) =>
      buildPointsService(ctx).summaryForCustomer(await orgId(), input.customerId),
    ),

  // ---- Admin (owner) --------------------------------------------------
  // Manual correction tied to a purchase (e.g. the scanner failed). Writes a
  // signed `adjust` ledger row + recomputes the tier; surfaces in the purchase
  // timeline. Owner-only.
  adjustForPurchase: ownerProcedure
    .input(adjustForPurchaseInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildPointsService(ctx).adjustForPurchase(
        await orgId(),
        input.purchaseId,
        input.points,
        input.reason,
        ctx.session.user.id,
      ),
    ),

  // ---- Customer (self) ------------------------------------------------
  mySummary: protectedProcedure.query(async ({ ctx }) =>
    buildPointsService(ctx).mySummary(await orgId(), ctx.session.user.id),
  ),

  myHistory: protectedProcedure
    .input(historyInputSchema)
    .query(async ({ ctx, input }) =>
      buildPointsService(ctx).myHistory(await orgId(), ctx.session.user.id, input),
    ),

  // Cursor-paginated, UI-friendly ledger (date-range + infinite scroll) for the
  // dedicated "Tus puntos" history view and the inline detail list.
  myTransactions: protectedProcedure
    .input(transactionsInputSchema)
    .query(async ({ ctx, input }) =>
      buildPointsService(ctx).myTransactions(
        await orgId(),
        ctx.session.user.id,
        input,
      ),
    ),
});

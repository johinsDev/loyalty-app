import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";

import {
  protectedProcedure,
  type RealtimeBinding,
  router,
  staffProcedure,
} from "../../trpc";
import { PointsRepository } from "./repository";
import { customerIdInputSchema, historyInputSchema } from "./schemas";
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

  // ---- Customer (self) ------------------------------------------------
  mySummary: protectedProcedure.query(async ({ ctx }) =>
    buildPointsService(ctx).mySummary(await orgId(), ctx.session.user.id),
  ),

  myHistory: protectedProcedure
    .input(historyInputSchema)
    .query(async ({ ctx, input }) =>
      buildPointsService(ctx).myHistory(await orgId(), ctx.session.user.id, input),
    ),
});

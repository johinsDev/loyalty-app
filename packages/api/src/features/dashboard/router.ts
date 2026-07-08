import { getPrimaryOrganizationId } from "@loyalty/db";

import { managerProcedure, router } from "../../trpc";
import { DashboardRepository } from "./repository";
import {
  overviewInputSchema,
  recentInputSchema,
  seriesInputSchema,
  topCustomersInputSchema,
} from "./schemas";

const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

/** Admin dashboard — Tier-1 real aggregates (KPIs, series, recent, top). */
export const dashboardRouter = router({
  overview: managerProcedure
    .input(overviewInputSchema)
    .query(async ({ ctx, input }) =>
      new DashboardRepository(ctx.db).overview(await orgId(), input.period),
    ),
  series: managerProcedure
    .input(seriesInputSchema)
    .query(async ({ ctx, input }) =>
      new DashboardRepository(ctx.db).series(await orgId(), input.period),
    ),
  recentPurchases: managerProcedure
    .input(recentInputSchema)
    .query(async ({ ctx, input }) =>
      new DashboardRepository(ctx.db).recentPurchases(await orgId(), input.limit),
    ),
  recentRedemptions: managerProcedure
    .input(recentInputSchema)
    .query(async ({ ctx, input }) =>
      new DashboardRepository(ctx.db).recentRedemptions(await orgId(), input.limit),
    ),
  topCustomers: managerProcedure
    .input(topCustomersInputSchema)
    .query(async ({ ctx, input }) =>
      new DashboardRepository(ctx.db).topCustomers(await orgId(), input.period, input.limit),
    ),
});

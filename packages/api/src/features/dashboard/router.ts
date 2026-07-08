import { getPrimaryOrganizationId } from "@loyalty/db";

import { managerProcedure, router } from "../../trpc";
import { DashboardRepository } from "./repository";
import {
  atRiskInputSchema,
  overviewInputSchema,
  recentInputSchema,
  seriesInputSchema,
  topCustomersInputSchema,
  topProductsInputSchema,
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
  atRisk: managerProcedure
    .input(atRiskInputSchema)
    .query(async ({ ctx, input }) =>
      new DashboardRepository(ctx.db).atRisk(await orgId(), input.days, input.limit),
    ),
  retention: managerProcedure
    .input(seriesInputSchema)
    .query(async ({ ctx, input }) =>
      new DashboardRepository(ctx.db).retention(await orgId(), input.period),
    ),
  redemptionEngagement: managerProcedure
    .input(seriesInputSchema)
    .query(async ({ ctx, input }) =>
      new DashboardRepository(ctx.db).redemptionEngagement(await orgId(), input.period),
    ),
  tiers: managerProcedure.query(async ({ ctx }) =>
    new DashboardRepository(ctx.db).tiers(await orgId()),
  ),
  liability: managerProcedure
    .input(seriesInputSchema)
    .query(async ({ ctx, input }) =>
      new DashboardRepository(ctx.db).liability(await orgId(), input.period),
    ),
  topProducts: managerProcedure
    .input(topProductsInputSchema)
    .query(async ({ ctx, input }) =>
      new DashboardRepository(ctx.db).topProducts(await orgId(), input.period, input.limit),
    ),
  salesByStore: managerProcedure
    .input(seriesInputSchema)
    .query(async ({ ctx, input }) =>
      new DashboardRepository(ctx.db).salesByStore(await orgId(), input.period),
    ),
});

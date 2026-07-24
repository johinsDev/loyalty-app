import { getPrimaryOrganizationId } from "@loyalty/db";

import { cachedRead, managerProcedure, router } from "../../trpc";
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

/** Read-through TTL for the dashboard aggregates. RSC fans a single view out
 *  into ~13 of these; caching org+scope+period-keyed for 60s means a reload (or
 *  the concurrent burst) mostly serves from cache instead of hitting Turso. The
 *  two "live" recent lists stay uncached. */
const TTL = 60;
const scope = (storeId: string | null | undefined) => storeId ?? "all";

/** Admin dashboard — Tier-1 real aggregates (KPIs, series, recent, top). */
export const dashboardRouter = router({
  navCounts: managerProcedure.query(async ({ ctx }) => {
    const org = await orgId();
    return cachedRead(ctx, `dash:navCounts:${org}`, TTL, () =>
      new DashboardRepository(ctx.db).navCounts(org),
    );
  }),
  /** Setup checklist — flags computed live; the card hides itself at 100%. */
  setupChecklist: managerProcedure.query(async ({ ctx }) => {
    const org = await orgId();
    return cachedRead(ctx, `dash:setup:${org}`, TTL, () =>
      new DashboardRepository(ctx.db).setupChecklist(org),
    );
  }),
  overview: managerProcedure
    .input(overviewInputSchema)
    .query(async ({ ctx, input }) => {
      const org = await orgId();
      return cachedRead(ctx, `dash:overview:${org}:${scope(input.storeId)}:${input.period}`, TTL, () =>
        new DashboardRepository(ctx.db, input.storeId).overview(org, input.period),
      );
    }),
  series: managerProcedure
    .input(seriesInputSchema)
    .query(async ({ ctx, input }) => {
      const org = await orgId();
      return cachedRead(ctx, `dash:series:${org}:${scope(input.storeId)}:${input.period}`, TTL, () =>
        new DashboardRepository(ctx.db, input.storeId).series(org, input.period),
      );
    }),
  recentPurchases: managerProcedure
    .input(recentInputSchema)
    .query(async ({ ctx, input }) =>
      new DashboardRepository(ctx.db, input.storeId).recentPurchases(await orgId(), input.limit),
    ),
  recentRedemptions: managerProcedure
    .input(recentInputSchema)
    .query(async ({ ctx, input }) =>
      new DashboardRepository(ctx.db).recentRedemptions(await orgId(), input.limit),
    ),
  topCustomers: managerProcedure
    .input(topCustomersInputSchema)
    .query(async ({ ctx, input }) => {
      const org = await orgId();
      return cachedRead(
        ctx,
        `dash:topCustomers:${org}:${scope(input.storeId)}:${input.period}:${input.limit}`,
        TTL,
        () => new DashboardRepository(ctx.db, input.storeId).topCustomers(org, input.period, input.limit),
      );
    }),
  atRisk: managerProcedure
    .input(atRiskInputSchema)
    .query(async ({ ctx, input }) => {
      const org = await orgId();
      return cachedRead(
        ctx,
        `dash:atRisk:${org}:${scope(input.storeId)}:${input.days}:${input.limit}`,
        TTL,
        () => new DashboardRepository(ctx.db, input.storeId).atRisk(org, input.days, input.limit),
      );
    }),
  retention: managerProcedure
    .input(seriesInputSchema)
    .query(async ({ ctx, input }) => {
      const org = await orgId();
      return cachedRead(ctx, `dash:retention:${org}:${input.period}`, TTL, () =>
        new DashboardRepository(ctx.db).retention(org, input.period),
      );
    }),
  redemptionEngagement: managerProcedure
    .input(seriesInputSchema)
    .query(async ({ ctx, input }) => {
      const org = await orgId();
      return cachedRead(ctx, `dash:redemptionEngagement:${org}:${input.period}`, TTL, () =>
        new DashboardRepository(ctx.db).redemptionEngagement(org, input.period),
      );
    }),
  tiers: managerProcedure.query(async ({ ctx }) => {
    const org = await orgId();
    return cachedRead(ctx, `dash:tiers:${org}`, TTL, () =>
      new DashboardRepository(ctx.db).tiers(org),
    );
  }),
  liability: managerProcedure
    .input(seriesInputSchema)
    .query(async ({ ctx, input }) => {
      const org = await orgId();
      return cachedRead(ctx, `dash:liability:${org}:${input.period}`, TTL, () =>
        new DashboardRepository(ctx.db).liability(org, input.period),
      );
    }),
  topProducts: managerProcedure
    .input(topProductsInputSchema)
    .query(async ({ ctx, input }) => {
      const org = await orgId();
      return cachedRead(
        ctx,
        `dash:topProducts:${org}:${scope(input.storeId)}:${input.period}:${input.limit}`,
        TTL,
        () => new DashboardRepository(ctx.db, input.storeId).topProducts(org, input.period, input.limit),
      );
    }),
  salesByStore: managerProcedure
    .input(seriesInputSchema)
    .query(async ({ ctx, input }) => {
      const org = await orgId();
      return cachedRead(ctx, `dash:salesByStore:${org}:${input.period}`, TTL, () =>
        new DashboardRepository(ctx.db).salesByStore(org, input.period),
      );
    }),
  cohorts: managerProcedure.query(async ({ ctx }) => {
    const org = await orgId();
    return cachedRead(ctx, `dash:cohorts:${org}`, TTL, () =>
      new DashboardRepository(ctx.db).cohorts(org),
    );
  }),
  funnel: managerProcedure
    .input(seriesInputSchema)
    .query(async ({ ctx, input }) => {
      const org = await orgId();
      return cachedRead(ctx, `dash:funnel:${org}:${input.period}`, TTL, () =>
        new DashboardRepository(ctx.db).funnel(org, input.period),
      );
    }),
});

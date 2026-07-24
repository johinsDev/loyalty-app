import "server-only";

import { cache } from "react";

import { trpc } from "@/lib/trpc/server";

import type { DashboardPeriod } from "../list-params";

/**
 * React-`cache()`-wrapped dashboard reads shared by more than one widget, so the
 * concurrent Suspense holes that need the same data (KPI row + both trend charts
 * all use `series`; KPI row + hero use `overview`) dedupe to a single Worker hop
 * per (period, storeId) instead of one per widget. Single-use queries call the
 * server caller directly.
 */
export const getOverview = cache(async (period: DashboardPeriod, storeId: string | null) =>
  (await trpc()).dashboard.overview({ period, storeId }),
);

export const getSeries = cache(async (period: DashboardPeriod, storeId: string | null) =>
  (await trpc()).dashboard.series({ period, storeId }),
);

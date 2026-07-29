import { Skeleton } from "@loyalty/ui";
import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { IslandBoundary } from "@/components/island-boundary";
import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string }> };

const fallback = (
  <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="mt-4 h-10 w-full max-w-md rounded-xl" />
    <Skeleton className="mt-4 h-80 w-full rounded-2xl" />
  </div>
);

/**
 * Retention cohorts — static shell with the seeded analytics view streaming into
 * the Suspense hole. The `dashboard.cohorts` prefetch lives in the nested async
 * {@link CohortsSeed} so nothing is awaited at the page top (that would de-opt the
 * static shell); AnalyticsView stays a live client query hydrated from the seed.
 */
export default function CohortsPage({ params }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={fallback}>
        <CohortsSeed params={params} />
      </Suspense>
    </IslandBoundary>
  );
}

async function CohortsSeed({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const api = await trpc();
  let initialCohorts: Awaited<ReturnType<typeof api.dashboard.cohorts>> | undefined;
  try {
    initialCohorts = await api.dashboard.cohorts();
  } catch {
    initialCohorts = undefined;
  }
  return <AnalyticsView section="cohorts" initialCohorts={initialCohorts} />;
}

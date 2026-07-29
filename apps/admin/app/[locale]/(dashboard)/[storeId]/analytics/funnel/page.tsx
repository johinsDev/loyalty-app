import { Skeleton } from "@loyalty/ui";
import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { IslandBoundary } from "@/components/island-boundary";
import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { loadAnalyticsSearchParams } from "@/features/analytics/list-params";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

const fallback = (
  <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="mt-4 h-10 w-full max-w-md rounded-xl" />
    <Skeleton className="mt-4 h-80 w-full rounded-2xl" />
  </div>
);

/**
 * Loyalty funnel — static shell with the seeded analytics view streaming into the
 * Suspense hole. The `dashboard.funnel` prefetch (for the URL period) lives in the
 * nested async {@link FunnelSeed} so nothing is awaited at the page top; the
 * client query hydrates from the seed and keeps it smooth across period changes.
 */
export default function FunnelPage({ params, searchParams }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={fallback}>
        <FunnelSeed params={params} searchParams={searchParams} />
      </Suspense>
    </IslandBoundary>
  );
}

async function FunnelSeed({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { period } = await loadAnalyticsSearchParams(searchParams);
  const api = await trpc();
  let initialFunnel: Awaited<ReturnType<typeof api.dashboard.funnel>> | undefined;
  try {
    initialFunnel = await api.dashboard.funnel({ period });
  } catch {
    initialFunnel = undefined;
  }
  return <AnalyticsView section="funnel" initialPeriod={period} initialFunnel={initialFunnel} />;
}

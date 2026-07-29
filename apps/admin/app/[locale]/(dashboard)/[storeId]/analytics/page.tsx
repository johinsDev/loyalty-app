import { setRequestLocale } from "next-intl/server";
import { Suspense } from "react";

import { IslandBoundary } from "@/components/island-boundary";
import { SectionSkeleton } from "@/components/section-skeleton";
import { AnalyticsView } from "@/features/analytics/components/analytics-view";

type Props = { params: Promise<{ locale: string }> };

export default function AnalyticsPage({ params }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={<SectionSkeleton />}>
        <AnalyticsSection params={params} />
      </Suspense>
    </IslandBoundary>
  );
}

async function AnalyticsSection({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AnalyticsView />;
}

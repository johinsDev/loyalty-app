import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { loadAnalyticsSearchParams } from "@/features/analytics/list-params";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/** RSC: prefetch the Overview aggregates (member growth + revenue series, tier
 *  mix, redemption engagement) for the URL period so the default section paints
 *  server-rendered; the client queries hydrate from this and stay smooth across
 *  period changes (keepPreviousData). */
export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { period } = await loadAnalyticsSearchParams(searchParams);

  const api = await trpc();
  const [series, tiers, engagement] = await Promise.all([
    api.dashboard.series({ period }).catch(() => undefined),
    api.dashboard.tiers().catch(() => undefined),
    api.dashboard.redemptionEngagement({ period }).catch(() => undefined),
  ]);

  return (
    <AnalyticsView
      section="overview"
      initialPeriod={period}
      initialSeries={series}
      initialTiers={tiers}
      initialEngagement={engagement}
    />
  );
}

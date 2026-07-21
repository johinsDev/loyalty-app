import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { loadAnalyticsSearchParams } from "@/features/analytics/list-params";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/** RSC: prefetch the loyalty funnel for the URL period so it paints
 *  server-rendered; the client query hydrates and keeps it smooth across period
 *  changes (keepPreviousData). */
export default async function Page({ params, searchParams }: Props) {
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
  return (
    <AnalyticsView section="funnel" initialPeriod={period} initialFunnel={initialFunnel} />
  );
}

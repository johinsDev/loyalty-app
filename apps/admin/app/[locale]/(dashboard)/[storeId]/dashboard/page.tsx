import { setRequestLocale } from "next-intl/server";

import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string }> };

/** RSC: prefetch the above-the-fold stats (KPIs + trend series) for the default
 *  30d window so they paint server-rendered — no initial skeleton flash. The
 *  client `useQuery` hydrates from these and drives period changes from there;
 *  the lower widgets load client-side with their own skeletons. */
export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const api = await trpc();
  let initialOverview: Awaited<ReturnType<typeof api.dashboard.overview>> | undefined;
  let initialSeries: Awaited<ReturnType<typeof api.dashboard.series>> | undefined;
  try {
    [initialOverview, initialSeries] = await Promise.all([
      api.dashboard.overview({ period: "30d" }),
      api.dashboard.series({ period: "30d" }),
    ]);
  } catch {
    initialOverview = undefined;
    initialSeries = undefined;
  }

  return <DashboardView initialOverview={initialOverview} initialSeries={initialSeries} />;
}

import { setRequestLocale } from "next-intl/server";

import { AnalyticsView } from "@/features/analytics/components/analytics-view";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string }> };

/** RSC: prefetch the retention cohorts (period-independent) so the table paints
 *  server-rendered; the client query hydrates from it. */
export default async function Page({ params }: Props) {
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

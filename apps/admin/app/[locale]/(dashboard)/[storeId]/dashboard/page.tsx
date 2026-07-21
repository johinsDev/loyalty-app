import { setRequestLocale } from "next-intl/server";

import { DashboardView } from "@/features/dashboard/components/dashboard-view";
import { loadStoreScope } from "@/lib/store-scope-server";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; storeId: string }> };

/** RSC: prefetch the above-the-fold stats (KPIs + trend series) for the default
 *  30d window so they paint server-rendered — no initial skeleton flash. The
 *  client `useQuery` hydrates from these and drives period changes from there;
 *  the lower widgets load client-side with their own skeletons. `storeId` scopes
 *  the prefetch to the active store (must match the client's query key). */
export default async function DashboardPage({ params }: Props) {
  const { locale, storeId: segment } = await params;
  setRequestLocale(locale);
  // Resolve the slug segment to the real store id (or null for "all") so the
  // prefetch's query key matches the client's scoped queries.
  const { scope } = await loadStoreScope(segment);
  const storeId = scope?.storeId ?? null;

  const api = await trpc();
  let initialOverview: Awaited<ReturnType<typeof api.dashboard.overview>> | undefined;
  let initialSeries: Awaited<ReturnType<typeof api.dashboard.series>> | undefined;
  try {
    [initialOverview, initialSeries] = await Promise.all([
      api.dashboard.overview({ period: "30d", storeId }),
      api.dashboard.series({ period: "30d", storeId }),
    ]);
  } catch {
    initialOverview = undefined;
    initialSeries = undefined;
  }

  return <DashboardView initialOverview={initialOverview} initialSeries={initialSeries} />;
}

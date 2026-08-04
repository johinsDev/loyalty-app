import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { ListPageSkeleton } from "@/components/data-table";
import { IslandBoundary } from "@/components/island-boundary";
import { AdminNotificationsView } from "@/features/admin-notifications/components/admin-notifications-view";
import {
  buildAlertsInput,
  loadAlertsSearchParams,
} from "@/features/admin-notifications/list-params";
import { loadStoreScope } from "@/lib/store-scope-server";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Alert inbox — a static shell with the seeded client view streaming into the
 * Suspense hole. The prefetch lives in the nested async {@link AlertsSeed} so
 * nothing is awaited at the page top (a top-level await de-opts the static
 * shell to dynamic).
 */
export default function NotificationsPage({ params, searchParams }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={<ListPageSkeleton />}>
        <AlertsSeed params={params} searchParams={searchParams} />
      </Suspense>
    </IslandBoundary>
  );
}

async function AlertsSeed({ params, searchParams }: Props) {
  const { locale, storeId } = await params;
  setRequestLocale(locale);
  const { scope } = await loadStoreScope(storeId);
  const input = buildAlertsInput({
    ...(await loadAlertsSearchParams(searchParams)),
    storeId: scope?.storeId ?? undefined,
  });
  let initialData:
    | Awaited<
        ReturnType<
          Awaited<ReturnType<typeof trpc>>["adminNotifications"]["listMine"]
        >
      >
    | undefined;
  try {
    initialData = await (await trpc()).adminNotifications.listMine(input);
  } catch {
    initialData = undefined;
  }
  return <AdminNotificationsView initialData={initialData} />;
}

import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { ListPageSkeleton } from "@/components/data-table";
import { IslandBoundary } from "@/components/island-boundary";
import { StoresView } from "@/features/stores/components/stores-view";
import { buildStoresInput, loadStoresSearchParams } from "@/features/stores/list-params";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Stores list — a **static** shell (prerendered) with the seeded client view
 * streaming into the Suspense hole. The server prefetch lives in the nested async
 * {@link StoresSeed} so nothing is awaited at the page top (a top-level await
 * de-opts the static shell to dynamic). StoresView deliberately stays a live
 * client react-query list (heavy bulk publish/unpublish/remove); the RSC only
 * seeds first paint.
 */
export default function StoresPage({ params, searchParams }: Props) {
  return (
    <IslandBoundary>
      <Suspense fallback={<ListPageSkeleton />}>
        <StoresSeed params={params} searchParams={searchParams} />
      </Suspense>
    </IslandBoundary>
  );
}

async function StoresSeed({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const input = buildStoresInput(await loadStoresSearchParams(searchParams));
  let initialData:
    | Awaited<ReturnType<Awaited<ReturnType<typeof trpc>>["stores"]["list"]>>
    | undefined;
  try {
    initialData = await (await trpc()).stores.list(input);
  } catch {
    initialData = undefined;
  }
  return <StoresView initialData={initialData} />;
}

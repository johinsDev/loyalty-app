import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import { StoresView } from "@/features/stores/components/stores-view";
import { buildStoresInput, loadStoresSearchParams } from "@/features/stores/list-params";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/** RSC: prefetch the first page (from the URL searchParams) so the list paints
 *  server-rendered; the client then drives refetching via nuqs + react-query. */
export default async function Page({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const input = buildStoresInput(await loadStoresSearchParams(searchParams));
  let initialData: Awaited<ReturnType<Awaited<ReturnType<typeof trpc>>["stores"]["list"]>> | undefined;
  try {
    const api = await trpc();
    initialData = await api.stores.list(input);
  } catch {
    initialData = undefined;
  }

  return <StoresView initialData={initialData} />;
}

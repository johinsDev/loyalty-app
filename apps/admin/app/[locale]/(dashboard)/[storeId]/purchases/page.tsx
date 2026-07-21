import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import { PurchasesView } from "@/features/purchases/components/purchases-view";
import { buildPurchasesInput, loadPurchasesSearchParams } from "@/features/purchases/list-params";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

/** RSC: prefetch the first page (from the URL searchParams) so the list paints
 *  server-rendered; the client then drives refetching via nuqs + react-query.
 *  Scoped to a store → hard-filter the prefetch to it so no all-store rows flash
 *  under a store view (matches the client's scoped input). */
export default async function Page({ params, searchParams }: Props) {
  const { locale, storeId: segment } = await params;
  setRequestLocale(locale);

  const loaded = await loadPurchasesSearchParams(searchParams);
  const input = buildPurchasesInput(
    segment === "all" ? loaded : { ...loaded, store: [segment] },
  );
  let initialData:
    | Awaited<ReturnType<Awaited<ReturnType<typeof trpc>>["purchases"]["adminList"]>>
    | undefined;
  try {
    const api = await trpc();
    initialData = await api.purchases.adminList(input);
  } catch {
    initialData = undefined;
  }

  return <PurchasesView initialData={initialData} />;
}

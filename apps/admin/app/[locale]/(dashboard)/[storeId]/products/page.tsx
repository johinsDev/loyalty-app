import { setRequestLocale } from "next-intl/server";

import { ProductsView } from "@/features/products/components/products-view";
import { loadStoreScope } from "@/lib/store-scope-server";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; storeId: string }> };

/** RSC: prefetch the product catalog on the server so it paints with the HTML
 *  (no client loading flash); the client then drives search/filters + refetch.
 *  Scoped to the active store so no all-store rows flash under a store view. */
export default async function ProductsPage({ params }: Props) {
  const { locale, storeId: segment } = await params;
  setRequestLocale(locale);

  const { scope } = await loadStoreScope(segment);
  let initialData:
    | Awaited<ReturnType<Awaited<ReturnType<typeof trpc>>["menu"]["adminList"]>>
    | undefined;
  try {
    const api = await trpc();
    initialData = await api.menu.adminList({
      perPage: 100,
      sort: "updated",
      dir: "desc",
      storeId: scope?.storeId ?? undefined,
    });
  } catch {
    initialData = undefined;
  }

  return <ProductsView initialData={initialData} />;
}

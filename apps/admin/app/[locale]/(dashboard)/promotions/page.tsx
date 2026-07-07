import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import { PromotionsView } from "@/features/promotions/components/promotions-view";
import { buildPromotionsInput, loadPromotionsSearchParams } from "@/features/promotions/list-params";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/** RSC: prefetch the first page (from the URL searchParams) so the list paints
 *  server-rendered; the client then drives refetching via nuqs + react-query. */
export default async function PromotionsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const input = buildPromotionsInput(await loadPromotionsSearchParams(searchParams));
  let initialData:
    | Awaited<ReturnType<Awaited<ReturnType<typeof trpc>>["promociones"]["adminList"]>>
    | undefined;
  try {
    const api = await trpc();
    initialData = await api.promociones.adminList(input);
  } catch {
    initialData = undefined;
  }

  return <PromotionsView initialData={initialData} />;
}

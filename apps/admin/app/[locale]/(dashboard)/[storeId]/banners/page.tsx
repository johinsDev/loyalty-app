import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import { BannersView } from "@/features/banners/components/banners-view";
import { buildBannersInput, loadBannersSearchParams } from "@/features/banners/list-params";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/** RSC: prefetch the first page (from the URL searchParams) so the list paints
 *  server-rendered; the client then drives refetching via nuqs + react-query. */
export default async function BannersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const input = buildBannersInput(await loadBannersSearchParams(searchParams));
  let initialData:
    | Awaited<ReturnType<Awaited<ReturnType<typeof trpc>>["banners"]["adminList"]>>
    | undefined;
  try {
    const api = await trpc();
    initialData = await api.banners.adminList(input);
  } catch {
    initialData = undefined;
  }

  return <BannersView initialData={initialData} />;
}

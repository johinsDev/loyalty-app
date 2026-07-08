import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import { RewardsView } from "@/features/rewards/components/rewards-view";
import { buildRewardsInput, loadRewardsSearchParams } from "@/features/rewards/list-params";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/** RSC: prefetch the first page (from the URL searchParams) so the list paints
 *  server-rendered; the client then drives refetching via nuqs + react-query. */
export default async function RewardsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const input = buildRewardsInput(await loadRewardsSearchParams(searchParams));
  let initialData:
    | Awaited<ReturnType<Awaited<ReturnType<typeof trpc>>["rewards"]["adminList"]>>
    | undefined;
  try {
    const api = await trpc();
    initialData = await api.rewards.adminList(input);
  } catch {
    initialData = undefined;
  }

  return <RewardsView initialData={initialData} />;
}

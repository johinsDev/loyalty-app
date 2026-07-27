import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import { CustomersKpis } from "@/features/customers/components/customers-kpis";
import { CustomersListHeader } from "@/features/customers/components/customers-list-header";
import { CustomersView } from "@/features/customers/components/customers-view";
import { buildCustomersInput, loadCustomersSearchParams } from "@/features/customers/list-params";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Customers list — a hydrated client table. The RSC prefetches the first page
 * (from the URL searchParams, Worker-cached) and hands it to {@link CustomersView}
 * as `initialData`, so the table paints server-rendered on entry; the client then
 * owns the react-query cache + refetching. The input is built with the same
 * `buildCustomersInput` the view uses, so the seed matches the client's queryKey.
 */
export default async function CustomersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const input = buildCustomersInput(await loadCustomersSearchParams(searchParams));
  let initialData:
    | Awaited<ReturnType<Awaited<ReturnType<typeof trpc>>["customers"]["adminList"]>>
    | undefined;
  try {
    const api = await trpc();
    initialData = await api.customers.adminList(input);
  } catch {
    initialData = undefined;
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <CustomersListHeader />
      <CustomersKpis />
      <CustomersView initialData={initialData} />
    </div>
  );
}

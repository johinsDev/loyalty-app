import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import { CustomersView } from "@/features/customers/components/customers-view";
import { buildCustomersInput, loadCustomersSearchParams } from "@/features/customers/list-params";
import { trpc } from "@/lib/trpc/server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

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

  return <CustomersView initialData={initialData} />;
}

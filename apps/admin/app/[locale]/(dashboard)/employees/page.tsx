import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import { EmployeesView } from "@/features/employees/components/employees-view";
import { buildEmployeesInput, loadEmployeesSearchParams } from "@/features/employees/list-params";
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

  const input = buildEmployeesInput(await loadEmployeesSearchParams(searchParams));
  let initialData:
    | Awaited<ReturnType<Awaited<ReturnType<typeof trpc>>["employees"]["list"]>>
    | undefined;
  try {
    const api = await trpc();
    initialData = await api.employees.list(input);
  } catch {
    initialData = undefined;
  }

  return <EmployeesView initialData={initialData} />;
}

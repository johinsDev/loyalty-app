import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { CustomersBulkBar } from "@/features/customers/components/customers-bulk-bar";
import { CustomersKpis } from "@/features/customers/components/customers-kpis";
import { CustomersListHeader } from "@/features/customers/components/customers-list-header";
import { CustomersTable } from "@/features/customers/components/customers-table";
import { CustomersToolbar } from "@/features/customers/components/customers-toolbar";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Customers list — the shell (header + KPIs island + toolbar) renders
 * synchronously so navigating here never flashes a full-page skeleton; only the
 * server-rendered table streams into its own `<Suspense>` hole. The boundary is
 * unkeyed, so filtering/paginating keeps the current rows during the RSC refetch
 * (React holds the old table through the transition) instead of re-skeletoning.
 */
export default function CustomersPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <CustomersListHeader />

      <CustomersKpis />

      <SelectionProvider>
        <CustomersToolbar />
        <div className="mt-4">
          <Suspense fallback={<DataTableSkeleton columns={7} />}>
            <CustomersTableSection params={params} searchParams={searchParams} />
          </Suspense>
        </div>
        <CustomersBulkBar />
      </SelectionProvider>
    </div>
  );
}

async function CustomersTableSection({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  return <CustomersTable searchParams={sp} />;
}

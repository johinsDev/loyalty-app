import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { IslandBoundary } from "@/components/island-boundary";
import { EmployeeDetailModalMount } from "@/features/employees/components/employee-detail-modal-mount";
import { EmployeesBulkBar } from "@/features/employees/components/employees-bulk-bar";
import { EmployeesListHeader } from "@/features/employees/components/employees-list-header";
import { EmployeesTable } from "@/features/employees/components/employees-table";
import { EmployeesToolbar } from "@/features/employees/components/employees-toolbar";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Employees list — the shell (header + toolbar) renders synchronously so
 * navigating here never flashes a full-page skeleton; only the server-rendered
 * table streams into its unkeyed `<Suspense>` hole (filtering keeps the current
 * rows through the RSC transition). Manager/owner gating is in `layout.tsx`.
 */
export default function EmployeesPage({ params, searchParams }: Props) {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <EmployeesListHeader />

      <SelectionProvider>
        <EmployeesToolbar />
        <div className="mt-4">
          <IslandBoundary>
            <Suspense fallback={<DataTableSkeleton columns={9} />}>
              <EmployeesTableSection params={params} searchParams={searchParams} />
            </Suspense>
          </IslandBoundary>
        </div>
        <EmployeesBulkBar />
      </SelectionProvider>

      <EmployeeDetailModalMount />
    </div>
  );
}

async function EmployeesTableSection({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  return <EmployeesTable searchParams={sp} />;
}

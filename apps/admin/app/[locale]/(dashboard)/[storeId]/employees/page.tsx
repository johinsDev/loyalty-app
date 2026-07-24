import { buttonVariants } from "@loyalty/ui";
import { ScrollText, Trophy } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { EmployeeDetailModalMount } from "@/features/employees/components/employee-detail-modal-mount";
import { EmployeeInviteButton } from "@/features/employees/components/employee-invite-button";
import { EmployeesBulkBar } from "@/features/employees/components/employees-bulk-bar";
import { EmployeesTable } from "@/features/employees/components/employees-table";
import { EmployeesToolbar } from "@/features/employees/components/employees-toolbar";
import { loadEmployeesSearchParams } from "@/features/employees/list-params";
import { Link } from "@/i18n/nav";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Employees list — the static shell (header + leaderboard/audit links +
 * owner-only invite island) with the server-rendered table streaming into a
 * `<Suspense>` hole. The Suspense `key` is the filter/search slice of the URL,
 * so filtering re-shows the skeleton while pagination/sort keep the current rows
 * during the RSC navigation. Manager/owner gating is enforced by `layout.tsx`.
 */
export default async function EmployeesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("Employees");

  const v = loadEmployeesSearchParams(sp);
  const filterKey = JSON.stringify({
    q: v.q,
    role: v.role,
    status: v.status,
    storeId: v.storeId,
    view: v.view,
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/employees/performance"
            className={buttonVariants({ variant: "outline", className: "h-10 gap-1.5 rounded-xl" })}
          >
            <Trophy className="size-4" />
            {t("leaderboard.link")}
          </Link>
          <Link
            href="/employees/audit"
            className={buttonVariants({ variant: "outline", className: "h-10 gap-1.5 rounded-xl" })}
          >
            <ScrollText className="size-4" />
            {t("auditLink")}
          </Link>
          <EmployeeInviteButton />
        </div>
      </div>

      <SelectionProvider>
        <EmployeesToolbar />
        <div className="mt-4">
          <Suspense key={filterKey} fallback={<DataTableSkeleton columns={9} />}>
            <EmployeesTable searchParams={sp} />
          </Suspense>
        </div>
        <EmployeesBulkBar />
      </SelectionProvider>

      <EmployeeDetailModalMount />
    </div>
  );
}

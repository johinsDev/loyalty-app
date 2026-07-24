import { buttonVariants } from "@loyalty/ui";
import { Plus } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import { DataTableSkeleton, SelectionProvider } from "@/components/data-table";
import { CustomersBulkBar } from "@/features/customers/components/customers-bulk-bar";
import { CustomersKpis } from "@/features/customers/components/customers-kpis";
import { CustomersTable } from "@/features/customers/components/customers-table";
import { CustomersToolbar } from "@/features/customers/components/customers-toolbar";
import { loadCustomersSearchParams } from "@/features/customers/list-params";
import { Link } from "@/i18n/nav";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Customers list — the static shell (header + KPIs island + toolbar) with the
 * server-rendered table streaming into a `<Suspense>` hole. The Suspense `key`
 * is the filter/search slice of the URL, so filtering re-shows the skeleton
 * while pagination/sort keep the current rows during the RSC navigation.
 */
export default async function CustomersPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const t = await getTranslations("Customers");

  const v = loadCustomersSearchParams(sp);
  const filterKey = JSON.stringify({
    q: v.q,
    tier: v.tier,
    status: v.status,
    from: v.from,
    to: v.to,
    spendMin: v.spendMin,
    spendMax: v.spendMax,
    view: v.view,
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Link href="/customers/new" className={buttonVariants({ className: "h-10 gap-1.5 rounded-xl" })}>
          <Plus className="size-4" />
          {t("addCustomer")}
        </Link>
      </div>

      <CustomersKpis />

      <SelectionProvider>
        <CustomersToolbar />
        <div className="mt-4">
          <Suspense key={filterKey} fallback={<DataTableSkeleton columns={7} />}>
            <CustomersTable searchParams={sp} />
          </Suspense>
        </div>
        <CustomersBulkBar />
      </SelectionProvider>
    </div>
  );
}

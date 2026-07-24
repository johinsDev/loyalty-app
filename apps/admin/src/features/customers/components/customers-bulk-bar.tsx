"use client";

import { formatDate } from "@loyalty/date";
import { Button } from "@loyalty/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { DataTableBulkBar, useSelection } from "@/components/data-table";
import { downloadCsv, rowsToCsv } from "@/lib/csv";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Bulk-action bar for the customers list — reads the selected ids from the
 * {@link useSelection} context and exports them to CSV (fetching the full rows
 * by id on demand, so the export isn't limited to the current page).
 */
export function CustomersBulkBar() {
  const t = useTranslations("Customers");
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { ids, clear } = useSelection();

  const onExport = async () => {
    const selectedIds = [...ids];
    const data = await queryClient.fetchQuery(
      trpc.customers.adminListByIds.queryOptions({ ids: selectedIds }),
    );
    downloadCsv(
      rowsToCsv(data, [
        { header: t("col.customer"), value: (c) => c.name ?? c.phone },
        { header: t("col.phone"), value: (c) => c.phone },
        { header: "Email", value: (c) => c.email ?? "" },
        { header: t("col.tier"), value: (c) => c.tierKey ?? "" },
        { header: t("col.visits"), value: (c) => String(c.visits) },
        { header: t("col.spent"), value: (c) => String(c.ltvCents / 100) },
        {
          header: t("col.lastVisit"),
          value: (c) => (c.lastVisitAt ? formatDate(c.lastVisitAt, { locale }) : ""),
        },
      ]),
      `clientes-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success(t("exported", { n: selectedIds.length }));
  };

  return (
    <DataTableBulkBar count={ids.size} onClear={clear}>
      <Button variant="ghost" size="sm" className="h-9 gap-1.5 rounded-full" onClick={onExport}>
        <Download className="size-4" />
        {t("bulkExport")}
      </Button>
    </DataTableBulkBar>
  );
}

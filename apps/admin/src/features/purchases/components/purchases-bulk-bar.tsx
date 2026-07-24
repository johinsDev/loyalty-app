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

/** Bulk-action bar for the purchases list — CSV export of the selected ids. */
export function PurchasesBulkBar() {
  const t = useTranslations("Purchases");
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { ids, clear } = useSelection();

  const onExport = async () => {
    const selectedIds = [...ids];
    const data = await queryClient.fetchQuery(
      trpc.purchases.adminListByIds.queryOptions({ ids: selectedIds }),
    );
    downloadCsv(
      rowsToCsv(data, [
        { header: t("col.date"), value: (p) => formatDate(p.createdAt, { locale }) },
        { header: t("col.customer"), value: (p) => p.customerName ?? p.customerPhone },
        { header: t("col.store"), value: (p) => p.storeName ?? "" },
        { header: t("col.cashier"), value: (p) => p.cashierName ?? "" },
        { header: t("col.detail"), value: (p) => p.itemSummary ?? "" },
        { header: t("col.discount"), value: (p) => String(p.discountCents / 100) },
        { header: t("col.amount"), value: (p) => String(p.totalCents / 100) },
        { header: t("col.stamps"), value: (p) => String(p.stampsEarned) },
        { header: t("col.points"), value: (p) => String(p.pointsEarned) },
      ]),
      `compras-${new Date().toISOString().slice(0, 10)}.csv`,
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

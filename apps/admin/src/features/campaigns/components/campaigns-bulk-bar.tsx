"use client";

import { formatDate } from "@loyalty/date";
import {
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { DataTableBulkBar, useSelection } from "@/components/data-table";
import { useRouter } from "@/i18n/nav";
import { downloadCsv, rowsToCsv } from "@/lib/csv";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Bulk-action bar for the campaigns list — CSV export + delete of the selected
 * ids (read from the {@link useSelection} context). A bulk delete changes the
 * list, so it refreshes the server-rendered table via `router.refresh()`.
 */
export function CampaignsBulkBar() {
  const t = useTranslations("Campaigns");
  const locale = useLocale();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ids, clear } = useSelection();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bulkRemove = useMutation(trpc.campaigns.bulkRemove.mutationOptions());

  const onExport = async () => {
    const selectedIds = [...ids];
    const data = await queryClient.fetchQuery(
      trpc.campaigns.listByIds.queryOptions({ ids: selectedIds }),
    );
    downloadCsv(
      rowsToCsv(data, [
        { header: t("colName"), value: (c) => c.name },
        { header: t("colType"), value: (c) => c.type },
        { header: t("colState"), value: (c) => c.displayState },
        { header: t("colChannels"), value: (c) => c.channelPriority.join(" · ") },
        { header: t("colSent"), value: (c) => String(c.sent) },
        { header: t("colCreated"), value: (c) => formatDate(c.createdAt, { locale }) },
      ]),
      `campaigns-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success(t("exported", { n: selectedIds.length }));
  };

  const onBulkDelete = () => {
    const selectedIds = [...ids];
    bulkRemove.mutate(
      { ids: selectedIds },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries(trpc.campaigns.adminList.queryFilter());
          clear();
          setConfirmDelete(false);
          router.refresh();
          toast.success(t("bulkDeleteOk", { n: selectedIds.length }));
        },
        onError: () => toast.error(t("saveError")),
      },
    );
  };

  return (
    <>
      <DataTableBulkBar count={ids.size} onClear={clear}>
        <Button variant="ghost" size="sm" className="h-9 gap-1.5 rounded-full" onClick={onExport}>
          <Download className="size-4" />
          {t("bulkExport")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-destructive h-9 gap-1.5 rounded-full"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-4" />
          {t("bulkDelete")}
        </Button>
      </DataTableBulkBar>

      <ResponsiveModal open={confirmDelete} onOpenChange={setConfirmDelete}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("bulkDeleteTitle", { n: ids.size })}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground px-4 pb-2 text-sm">{t("bulkDeleteHint")}</p>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setConfirmDelete(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 rounded-full px-6 font-semibold"
              onClick={onBulkDelete}
              disabled={bulkRemove.isPending}
            >
              {t("deleteConfirm")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

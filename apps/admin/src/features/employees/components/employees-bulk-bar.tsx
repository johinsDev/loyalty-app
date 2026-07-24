"use client";

import { authClient } from "@loyalty/auth/client";
import {
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Ban, Download, Trash2, UserCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { DataTableBulkBar, useSelection } from "@/components/data-table";
import { useRouter } from "@/i18n/nav";
import { downloadCsv, rowsToCsv } from "@/lib/csv";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Bulk-action bar for the employees list — owner-only. Reads the selected ids
 * from the {@link useSelection} context and exports to CSV (fetching the full
 * rows by id on demand), disables/enables, or removes. Every list-changing
 * mutation calls `router.refresh()` to re-run the server table render (the
 * legacy `invalidateQueries` is kept as a harmless no-op).
 */
export function EmployeesBulkBar() {
  const t = useTranslations("Employees");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { ids, clear } = useSelection();
  const { data: session } = authClient.useSession();
  const isOwner = (session?.user as { role?: string } | undefined)?.role === "admin";

  const invalidate = () => queryClient.invalidateQueries(trpc.employees.list.queryFilter());
  const bulkSetDisabled = useMutation(trpc.employees.bulkSetDisabled.mutationOptions());
  const bulkRemove = useMutation(trpc.employees.bulkRemove.mutationOptions());
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOwner) return null;

  const onExport = async () => {
    const selectedIds = [...ids];
    const data = await queryClient.fetchQuery(
      trpc.employees.listByIds.queryOptions({ ids: selectedIds }),
    );
    downloadCsv(
      rowsToCsv(data, [
        { header: t("col.employee"), value: (e) => e.name ?? "" },
        { header: t("col.email"), value: (e) => e.email ?? "" },
        { header: t("col.role"), value: (e) => e.role },
        { header: t("col.stores"), value: (e) => e.stores.map((s) => s.name).join(" | ") },
        { header: t("col.rating"), value: (e) => (e.rating ? String(e.rating) : "") },
        { header: t("col.status"), value: (e) => e.status },
      ]),
      `empleados-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success(t("exported", { n: selectedIds.length }));
  };

  const onSetDisabled = (disabled: boolean) =>
    bulkSetDisabled.mutate(
      { ids: [...ids], disabled },
      {
        onSuccess: async () => {
          await invalidate();
          router.refresh();
          clear();
          toast.success(disabled ? t("disabled") : t("enabled"));
        },
        onError: () => toast.error(t("saveError")),
      },
    );

  const onBulkDelete = () => {
    const n = ids.size;
    bulkRemove.mutate(
      { ids: [...ids] },
      {
        onSuccess: async () => {
          await invalidate();
          router.refresh();
          clear();
          setConfirmDelete(false);
          toast.success(t("bulkDeleteOk", { n }));
        },
        onError: () => toast.error(t("removeError")),
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
          className="h-9 gap-1.5 rounded-full"
          onClick={() => onSetDisabled(true)}
          disabled={bulkSetDisabled.isPending}
        >
          <Ban className="size-4" />
          {t("disable")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1.5 rounded-full"
          onClick={() => onSetDisabled(false)}
          disabled={bulkSetDisabled.isPending}
        >
          <UserCheck className="size-4" />
          {t("enable")}
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
              {t("removeConfirm")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

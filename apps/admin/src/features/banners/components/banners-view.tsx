"use client";

import { formatDate, localeFromCode } from "@loyalty/date";
import type { BannerListItem, BannersListInput } from "@loyalty/api/features/banners/schemas";
import {
  Badge,
  Button,
  Calendar,
  Checkbox,
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Bell, Download, Plus, Trash2 } from "lucide-react";
import { parseAsArrayOf, parseAsIsoDate, parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import {
  DataTable,
  DataTableBulkBar,
  DataTableColumnHeader,
  DataTableFilters,
  DataTablePagination,
  DataTableSortList,
  DataTableViewOptions,
  FilterSection,
  tableParsers,
} from "@/components/data-table";
import { useDataTable } from "@/components/data-table/use-data-table";
import { ViewToggle } from "@/components/view-toggle";
import { downloadCsv, rowsToCsv } from "@/lib/csv";
import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { buildBannersInput } from "../list-params";
import { BannerDetailModal } from "./banner-detail-modal";
import { BannerRowActions } from "./banner-row-actions";

type BannerState = "draft" | "scheduled" | "active" | "expired";
const STATE_VALUES: BannerState[] = ["draft", "scheduled", "active", "expired"];

const STATE_STYLE: Record<BannerState, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  expired: "bg-muted text-muted-foreground",
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

type BannersListResult = { rows: BannerListItem[]; total: number; pageCount: number };

export function BannersView({ initialData }: { initialData?: BannersListResult }) {
  const t = useTranslations("Banners");
  const locale = useLocale();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [q, setQ] = useQueryState("q", tableParsers.q);
  const [state, setState] = useQueryState("state", parseAsArrayOf(parseAsString).withDefault([]));
  const [from, setFrom] = useQueryState("from", parseAsIsoDate);
  const [to, setTo] = useQueryState("to", parseAsIsoDate);
  const [, setPage] = useQueryState("page", tableParsers.page);
  const [sort] = useQueryState("sort", tableParsers.sort);
  const [page] = useQueryState("page", tableParsers.page);
  const [perPage] = useQueryState("perPage", tableParsers.perPage);
  const [view, setView] = useQueryState("view", tableParsers.view);
  const [detailId, setDetailId] = useQueryState("detalle", parseAsString);

  const resetPage = () => void setPage(1);

  const [search, setSearch] = useState(q);
  const debounce = useRef<ReturnType<typeof setTimeout>>(undefined);
  const onSearch = (value: string) => {
    setSearch(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      void setQ(value || null);
      resetPage();
    }, 350);
  };

  const activeFacets =
    (state.length > 0 && state.length < STATE_VALUES.length ? 1 : 0) + (from || to ? 1 : 0);
  const clearFilters = () => {
    void setState([]);
    void setFrom(null);
    void setTo(null);
    resetPage();
  };
  const toggleState = (v: string) => {
    void setState(state.includes(v) ? state.filter((x) => x !== v) : [...state, v]);
    resetPage();
  };

  const input: BannersListInput = useMemo(
    () => buildBannersInput({ q, page, perPage, sort, state, from, to }),
    [q, page, perPage, sort, state, from, to],
  );

  const initialKey = useRef(JSON.stringify(input));
  const useInitial = initialData && JSON.stringify(input) === initialKey.current;
  const query = useQuery(
    trpc.banners.adminList.queryOptions(input, {
      placeholderData: keepPreviousData,
      ...(useInitial ? { initialData } : {}),
    }),
  );
  const rows = query.data?.rows ?? [];
  const pageCount = query.data?.pageCount ?? 1;
  const total = query.data?.total ?? 0;

  const scheduleLabel = (b: BannerListItem): string => {
    const f = b.displayFrom ? formatDate(b.displayFrom, { locale }) : null;
    const u = b.displayUntil ? formatDate(b.displayUntil, { locale }) : null;
    if (!f && !u) return t("scheduleAlways");
    return `${f ?? "—"} → ${u ?? "∞"}`;
  };

  const columns = useMemo<ColumnDef<BannerListItem, unknown>[]>(
    () => [
      {
        id: "select",
        enableSorting: false,
        enableHiding: false,
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            indeterminate={table.getIsSomePageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label={t("selectAll")}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(v) => row.toggleSelected(!!v)}
            aria-label={t("selectRow")}
          />
        ),
      },
      {
        accessorKey: "name",
        meta: { label: t("colName") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("colName")} />,
        cell: ({ row }) => (
          <button
            type="button"
            className="hover:text-primary flex cursor-pointer items-center gap-2.5 text-left font-semibold hover:underline"
            onClick={() => void setDetailId(row.original.id)}
          >
            <span
              className="border-border size-8 shrink-0 rounded-lg border"
              style={{ background: row.original.backgroundCss ?? "var(--muted)" }}
            />
            <span className="line-clamp-1">{row.original.name || t("namePlaceholder")}</span>
          </button>
        ),
      },
      {
        accessorKey: "slug",
        enableSorting: false,
        meta: { label: t("colSlug") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("colSlug")}</span>,
        cell: ({ row }) => (
          <span className="text-muted-foreground font-mono text-xs">/{row.original.slug}</span>
        ),
      },
      {
        accessorKey: "displayState",
        enableSorting: false,
        meta: { label: t("colState") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("colState")}</span>,
        cell: ({ row }) => (
          <Badge className={`border-0 ${STATE_STYLE[row.original.displayState]}`}>
            {t(`state.${row.original.displayState}`)}
          </Badge>
        ),
      },
      {
        accessorKey: "displayFrom",
        enableSorting: false,
        meta: { label: t("colSchedule") },
        header: () => (
          <span className="text-muted-foreground text-xs font-bold">{t("colSchedule")}</span>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">{scheduleLabel(row.original)}</span>
        ),
      },
      {
        accessorKey: "notificationCount",
        enableSorting: false,
        meta: { label: t("colNotifications") },
        header: () => (
          <span className="text-muted-foreground text-xs font-bold">{t("colNotifications")}</span>
        ),
        cell: ({ row }) =>
          row.original.notificationCount > 0 ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
              <Bell className="size-3.5" />
              {row.original.notificationCount}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "createdAt",
        meta: { label: t("colCreated") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("colCreated")} />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">
            {formatDate(row.original.createdAt, { locale })}
          </span>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => <BannerRowActions banner={row.original} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, locale, setDetailId],
  );

  const { table, selectedIds, resetSelection } = useDataTable<BannerListItem>({
    data: rows,
    columns,
    pageCount,
    getRowId: (r) => r.id,
  });

  const invalidate = () => queryClient.invalidateQueries(trpc.banners.adminList.queryFilter());
  const bulkRemove = useMutation(trpc.banners.bulkRemove.mutationOptions());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onExport = async () => {
    const data = await queryClient.fetchQuery(trpc.banners.listByIds.queryOptions({ ids: selectedIds }));
    downloadCsv(
      rowsToCsv(data, [
        { header: t("colName"), value: (b) => b.name },
        { header: t("colSlug"), value: (b) => b.slug },
        { header: t("colState"), value: (b) => b.displayState },
        { header: t("colNotifications"), value: (b) => String(b.notificationCount) },
        { header: t("colCreated"), value: (b) => formatDate(b.createdAt, { locale }) },
      ]),
      `banners-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success(t("exported", { n: selectedIds.length }));
  };

  const onBulkDelete = () =>
    bulkRemove.mutate(
      { ids: selectedIds },
      {
        onSuccess: async () => {
          await invalidate();
          resetSelection();
          setConfirmDelete(false);
          toast.success(t("bulkDeleteOk", { n: selectedIds.length }));
        },
        onError: () => toast.error(t("saveError")),
      },
    );

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button className="h-10 gap-1.5 rounded-xl" onClick={() => router.push("/banners/new")}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full sm:w-64"
        />
        <DataTableFilters activeCount={activeFacets} onClear={clearFilters}>
          <FilterSection label={t("colState")}>
            {STATE_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={state.includes(v)} onCheckedChange={() => toggleState(v)} />
                {t(`state.${v}`)}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("colCreated")}>
            <div className="border-border flex justify-center rounded-2xl border p-1.5">
              <Calendar
                mode="range"
                className="[--cell-size:--spacing(9)]"
                locale={localeFromCode(locale)}
                selected={{ from: from ?? undefined, to: to ?? undefined }}
                onSelect={(r: { from?: Date; to?: Date } | undefined) => {
                  void setFrom(r?.from ?? null);
                  void setTo(r?.to ?? null);
                  resetPage();
                }}
                disabled={{ after: new Date() }}
              />
            </div>
            {from || to ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-lg"
                onClick={() => {
                  void setFrom(null);
                  void setTo(null);
                  resetPage();
                }}
              >
                {t("clearDate")}
              </Button>
            ) : null}
          </FilterSection>
        </DataTableFilters>
        <div className="ml-auto flex items-center gap-2">
          <DataTableSortList table={table} />
          <DataTableViewOptions table={table} />
          <ViewToggle value={view} onValueChange={(v) => setView(v)} ariaLabel={t("viewToggle")} />
        </div>
      </div>

      <div className="mt-4">
        <DataTable
          table={table}
          view={view}
          isFetching={query.isFetching}
          emptyState={
            <div className="text-muted-foreground grid h-40 place-items-center px-6 text-center">
              <div>
                <p className="text-foreground font-semibold">{t("empty")}</p>
                <p className="mt-1 text-sm">{t("emptyHint")}</p>
              </div>
            </div>
          }
          renderGrid={(items) => (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((b) => (
                <div
                  key={b.id}
                  role="button"
                  tabIndex={0}
                  className="bg-card border-border hover:border-primary/40 flex cursor-pointer flex-col overflow-hidden rounded-3xl border shadow-sm transition-colors"
                  onClick={() => void setDetailId(b.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void setDetailId(b.id);
                    }
                  }}
                >
                  <div className="relative h-28" style={{ background: b.backgroundCss ?? "var(--muted)" }}>
                    <Badge className={`absolute top-3 left-3 border-0 ${STATE_STYLE[b.displayState]}`}>
                      {t(`state.${b.displayState}`)}
                    </Badge>
                    <div
                      className="absolute top-2 right-2 flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <div className="bg-card/80 rounded-lg backdrop-blur">
                        <BannerRowActions banner={b} />
                      </div>
                    </div>
                    <div
                      className="absolute bottom-2 left-3"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={table.getRow(b.id)?.getIsSelected() ?? false}
                        onCheckedChange={(v) => table.getRow(b.id)?.toggleSelected(!!v)}
                        aria-label={t("selectRow")}
                      />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="font-semibold">{b.name || t("namePlaceholder")}</p>
                    <p className="text-muted-foreground mt-0.5 font-mono text-xs">/{b.slug}</p>
                    <div className="text-muted-foreground mt-3 flex items-center gap-3 text-xs font-semibold">
                      <span>{scheduleLabel(b)}</span>
                      {b.notificationCount > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <Bell className="size-3.5" />
                          {b.notificationCount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        />
        <DataTablePagination table={table} total={total} selectedCount={selectedIds.length} />
      </div>

      <DataTableBulkBar count={selectedIds.length} onClear={resetSelection}>
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

      <BulkDeleteDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        count={selectedIds.length}
        busy={bulkRemove.isPending}
        onConfirm={onBulkDelete}
      />

      <BannerDetailModal id={detailId} onClose={() => void setDetailId(null)} />
    </div>
  );
}

function BulkDeleteDialog({
  open,
  onOpenChange,
  count,
  busy,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  count: number;
  busy: boolean;
  onConfirm: () => void;
}) {
  const t = useTranslations("Banners");
  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent>
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>{t("bulkDeleteTitle", { n: count })}</ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <p className="text-muted-foreground px-4 pb-2 text-sm">{t("bulkDeleteHint")}</p>
        <ResponsiveModalFooter className="gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-full px-5"
            onClick={() => onOpenChange(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 rounded-full px-6 font-semibold"
            onClick={onConfirm}
            disabled={busy}
          >
            {t("deleteConfirm")}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

"use client";

import { formatDate, localeFromCode } from "@loyalty/date";
import type { StoreListItem, StoresListInput } from "@loyalty/api/features/stores/schemas";
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
  Switch,
} from "@loyalty/ui";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, MapPin, Plus, Trash2 } from "lucide-react";
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

import { buildStoresInput } from "../list-params";
import { StoreRowActions } from "./store-row-actions";

const STATUS_VALUES = ["draft", "published"] as const;

type StoreListResult = { rows: StoreListItem[]; total: number; pageCount: number };

export function StoresView({ initialData }: { initialData?: StoreListResult }) {
  const t = useTranslations("Stores");
  const locale = useLocale();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  // ── Feature-specific URL state (facets + q). page/perPage/sort/view/cols live
  //    in useDataTable. ───────────────────────────────────────────────────────
  const [q, setQ] = useQueryState("q", tableParsers.q);
  const [status, setStatus] = useQueryState("status", parseAsArrayOf(parseAsString).withDefault([]));
  const [visible, setVisible] = useQueryState("visible", parseAsString);
  const [primary, setPrimary] = useQueryState("primary", parseAsString);
  const [from, setFrom] = useQueryState("from", parseAsIsoDate);
  const [to, setTo] = useQueryState("to", parseAsIsoDate);
  const [, setPage] = useQueryState("page", tableParsers.page);
  const [sort] = useQueryState("sort", tableParsers.sort);
  const [page] = useQueryState("page", tableParsers.page);
  const [perPage] = useQueryState("perPage", tableParsers.perPage);
  const [view, setView] = useQueryState("view", tableParsers.view);

  const resetPage = () => void setPage(1);

  // Local search box (debounced into the URL `q`).
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

  // Count only facets that actually narrow the list (both status checked = all).
  const activeFacets =
    (status.length > 0 && status.length < STATUS_VALUES.length ? 1 : 0) +
    (visible !== null ? 1 : 0) +
    (primary !== null ? 1 : 0) +
    (from || to ? 1 : 0);
  const clearFilters = () => {
    void setStatus([]);
    void setVisible(null);
    void setPrimary(null);
    void setFrom(null);
    void setTo(null);
    resetPage();
  };
  const toggleStatus = (v: string) => {
    void setStatus(status.includes(v) ? status.filter((x) => x !== v) : [...status, v]);
    resetPage();
  };

  const input: StoresListInput = useMemo(
    () => buildStoresInput({ q, page, perPage, sort, status, visible, primary, from, to }),
    [q, page, perPage, sort, status, visible, primary, from, to],
  );

  const initialKey = useRef(JSON.stringify(input));
  const useInitial = initialData && JSON.stringify(input) === initialKey.current;
  const query = useQuery(
    trpc.stores.list.queryOptions(input, {
      placeholderData: keepPreviousData,
      ...(useInitial ? { initialData } : {}),
    }),
  );
  const rows = query.data?.rows ?? [];
  const pageCount = query.data?.pageCount ?? 1;
  const total = query.data?.total ?? 0;

  const columns = useMemo<ColumnDef<StoreListItem, unknown>[]>(
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
          <span className="font-semibold">{row.original.name || t("namePlaceholder")}</span>
        ),
      },
      {
        accessorKey: "address",
        enableSorting: false,
        meta: { label: t("colAddress") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("colAddress")}</span>,
        cell: ({ row }) =>
          row.original.address ? (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-sm">
              <MapPin className="size-3.5 shrink-0" />
              <span className="line-clamp-1">{row.original.address}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "status",
        meta: { label: t("colStatus") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("colStatus")} />,
        cell: ({ row }) =>
          row.original.status === "draft" ? (
            <Badge variant="outline">{t("draft")}</Badge>
          ) : (
            <Badge>{t("published")}</Badge>
          ),
      },
      {
        accessorKey: "isPrimary",
        enableSorting: false,
        meta: { label: t("colPrimary") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("colPrimary")}</span>,
        cell: ({ row }) =>
          row.original.isPrimary ? <Badge variant="secondary">{t("primary")}</Badge> : null,
      },
      {
        accessorKey: "isPublished",
        enableSorting: false,
        meta: { label: t("colVisible") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("colVisible")}</span>,
        cell: ({ row }) => (
          <Badge variant={row.original.isPublished ? "default" : "outline"}>
            {row.original.isPublished ? t("yes") : t("no")}
          </Badge>
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
        cell: ({ row }) => <StoreRowActions store={row.original} />,
      },
    ],
    [t, locale],
  );

  const { table, selectedIds, resetSelection } = useDataTable<StoreListItem>({
    data: rows,
    columns,
    pageCount,
    getRowId: (r) => r.id,
  });

  // ── Bulk ──────────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries(trpc.stores.list.queryFilter());
  const setPublished = useMutation(trpc.stores.bulkSetPublished.mutationOptions());
  const bulkRemove = useMutation(trpc.stores.bulkRemove.mutationOptions());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onExport = async () => {
    const data = await queryClient.fetchQuery(trpc.stores.listByIds.queryOptions({ ids: selectedIds }));
    downloadCsv(
      rowsToCsv(data, [
        { header: t("colName"), value: (s) => s.name },
        { header: t("colAddress"), value: (s) => s.address },
        { header: t("colStatus"), value: (s) => s.status },
        { header: t("colPrimary"), value: (s) => (s.isPrimary ? "1" : "0") },
        { header: t("colVisible"), value: (s) => (s.isPublished ? "1" : "0") },
        { header: t("colCreated"), value: (s) => formatDate(s.createdAt, { locale }) },
      ]),
      `tiendas-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success(t("exported", { n: selectedIds.length }));
  };

  const onSetPublished = (isPublished: boolean) =>
    setPublished.mutate(
      { ids: selectedIds, isPublished },
      {
        onSuccess: async () => {
          await invalidate();
          resetSelection();
          toast.success(t("bulkPublishOk", { n: selectedIds.length }));
        },
        onError: () => toast.error(t("saveError")),
      },
    );

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
        onError: () => toast.error(t("deleteLastError")),
      },
    );

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button className="h-10 gap-1.5 rounded-xl" onClick={() => router.push("/stores/new")}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      {/* Toolbar — search + a Filters drawer; only Sort/View/toggle stay inline. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full sm:w-64"
        />
        <DataTableFilters activeCount={activeFacets} onClear={clearFilters}>
          <FilterSection label={t("colStatus")}>
            {STATUS_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={status.includes(v)} onCheckedChange={() => toggleStatus(v)} />
                {t(v === "draft" ? "draft" : "published")}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("colVisible")}>
            <label className="flex cursor-pointer items-center justify-between text-sm">
              {t("onlyVisible")}
              <Switch
                checked={visible === "true"}
                onCheckedChange={(on) => {
                  void setVisible(on ? "true" : null);
                  resetPage();
                }}
              />
            </label>
          </FilterSection>

          <FilterSection label={t("colPrimary")}>
            {[
              { v: null, l: t("allPrimary") },
              { v: "primary", l: t("primary") },
              { v: "secondary", l: t("notPrimary") },
            ].map((opt) => (
              <button
                key={opt.l}
                type="button"
                onClick={() => {
                  void setPrimary(opt.v);
                  resetPage();
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 text-left text-sm"
              >
                <span
                  className={`grid size-4 place-items-center rounded-full border ${
                    primary === opt.v ? "border-primary" : "border-muted-foreground/40"
                  }`}
                >
                  {primary === opt.v ? <span className="bg-primary size-2 rounded-full" /> : null}
                </span>
                {opt.l}
              </button>
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
              {items.map((s) => (
                <div key={s.id} className="bg-card border-border rounded-3xl border p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <Checkbox
                      checked={table.getRow(s.id)?.getIsSelected() ?? false}
                      onCheckedChange={(v) => table.getRow(s.id)?.toggleSelected(!!v)}
                      aria-label={t("selectRow")}
                    />
                    <StoreRowActions store={s} />
                  </div>
                  <p className="mt-2 font-semibold">{s.name || t("namePlaceholder")}</p>
                  {s.address ? (
                    <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">{s.address}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {s.isPrimary ? <Badge variant="secondary">{t("primary")}</Badge> : null}
                    {s.status === "draft" ? (
                      <Badge variant="outline">{t("draft")}</Badge>
                    ) : (
                      <Badge>{t("published")}</Badge>
                    )}
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
          className="h-9 rounded-full"
          onClick={() => onSetPublished(true)}
          disabled={setPublished.isPending}
        >
          {t("bulkPublish")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 rounded-full"
          onClick={() => onSetPublished(false)}
          disabled={setPublished.isPending}
        >
          {t("bulkUnpublish")}
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
  const t = useTranslations("Stores");
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

"use client";

import type {
  AdminAlertListItem,
  AdminAlertsListInput,
} from "@loyalty/api/features/admin-notifications/schemas";
import { formatDateTime, formatRelative, localeFromCode } from "@loyalty/date";
import {
  Badge,
  Button,
  Calendar,
  Checkbox,
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Archive, ArchiveRestore } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  parseAsArrayOf,
  parseAsIsoDate,
  parseAsString,
  parseAsStringLiteral,
  useQueryState,
} from "nuqs";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { useStoreScope } from "@/lib/store-scope";
import { useTRPC } from "@/lib/trpc/client";

import { alertIcon, severityTone } from "../alert-meta";
import { AlertDetail } from "./alert-detail";
import {
  ALERT_TYPE_VALUES,
  buildAlertsInput,
  SEVERITY_VALUES,
} from "../list-params";

type AlertsResult = {
  rows: AdminAlertListItem[];
  total: number;
  pageCount: number;
};

const TABS = ["inbox", "archive"] as const;
const READ_STATES = ["read", "unread"] as const;

/**
 * The full alert inbox. Server-driven like every other admin list, with the
 * table state in the URL so a filtered view is shareable and reload-safe.
 *
 * The store switcher acts as a filter here rather than a hard scope: picking
 * a branch narrows to that branch's alerts PLUS the org-wide ones, because
 * "role changed" belongs to every scope.
 */
export function AdminNotificationsView({
  initialData,
}: {
  initialData?: AlertsResult;
}) {
  const t = useTranslations("Inbox");
  const tt = useTranslations("Inbox.types");
  const ts = useTranslations("Inbox.severity");
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { storeId } = useStoreScope();

  const [q, setQ] = useQueryState("q", tableParsers.q);
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("inbox"),
  );
  const [type, setType] = useQueryState(
    "type",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [severity, setSeverity] = useQueryState(
    "severity",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [read, setRead] = useQueryState(
    "read",
    parseAsStringLiteral(READ_STATES),
  );
  const [from, setFrom] = useQueryState("from", parseAsIsoDate);
  const [to, setTo] = useQueryState("to", parseAsIsoDate);
  const [page, setPage] = useQueryState("page", tableParsers.page);
  const [perPage] = useQueryState("perPage", tableParsers.perPage);
  const [sort] = useQueryState("sort", tableParsers.sort);
  const [view] = useQueryState("view", tableParsers.view);
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
    (type.length > 0 && type.length < ALERT_TYPE_VALUES.length ? 1 : 0) +
    (severity.length > 0 && severity.length < SEVERITY_VALUES.length ? 1 : 0) +
    (read !== null ? 1 : 0) +
    (from || to ? 1 : 0);

  const clearFilters = () => {
    void setType([]);
    void setSeverity([]);
    void setRead(null);
    void setFrom(null);
    void setTo(null);
    resetPage();
  };

  const toggle = (
    values: string[],
    setter: (v: string[]) => void,
    value: string,
  ) => {
    setter(
      values.includes(value)
        ? values.filter((x) => x !== value)
        : [...values, value],
    );
    resetPage();
  };

  const input: AdminAlertsListInput = useMemo(
    () =>
      buildAlertsInput({
        q,
        page,
        perPage,
        sort,
        tab,
        type,
        severity,
        read,
        from,
        to,
        storeId: storeId ?? undefined,
      }),
    [q, page, perPage, sort, tab, type, severity, read, from, to, storeId],
  );

  const initialKey = useRef(JSON.stringify(input));
  const useInitial = initialData && JSON.stringify(input) === initialKey.current;
  const query = useQuery(
    trpc.adminNotifications.listMine.queryOptions(input, {
      placeholderData: keepPreviousData,
      ...(useInitial ? { initialData } : {}),
    }),
  );
  const rows = query.data?.rows ?? [];
  const pageCount = query.data?.pageCount ?? 1;
  const total = query.data?.total ?? 0;

  const columns = useMemo<ColumnDef<AdminAlertListItem, unknown>[]>(
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
        accessorKey: "title",
        meta: { label: t("colAlert") },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("colAlert")} />
        ),
        cell: ({ row }) => {
          const Icon = alertIcon(row.original.type);
          return (
            <button
              type="button"
              className="flex cursor-pointer items-start gap-3 text-left"
              onClick={() => void setDetailId(row.original.id)}
            >
              <span
                className={`grid size-8 flex-none place-items-center rounded-full ${severityTone(row.original.severity)}`}
              >
                <Icon className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold">
                  {row.original.readAt ? null : (
                    <span className="bg-primary size-1.5 rounded-full" />
                  )}
                  {row.original.title}
                </span>
                <span className="text-muted-foreground line-clamp-1 text-sm">
                  {row.original.body}
                </span>
              </span>
            </button>
          );
        },
      },
      {
        accessorKey: "type",
        meta: { label: t("colType") },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("colType")} />
        ),
        cell: ({ row }) => (
          <Badge variant="outline">{tt(row.original.type)}</Badge>
        ),
      },
      {
        accessorKey: "severity",
        meta: { label: t("colSeverity") },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("colSeverity")} />
        ),
        cell: ({ row }) => (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityTone(row.original.severity)}`}
          >
            {ts(row.original.severity)}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        meta: { label: t("colWhen") },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("colWhen")} />
        ),
        cell: ({ row }) => (
          <span
            className="text-muted-foreground text-sm whitespace-nowrap"
            title={formatDateTime(row.original.createdAt, { locale })}
          >
            {formatRelative(row.original.createdAt, { locale })}
          </span>
        ),
      },
    ],
    [t, tt, ts, locale, setDetailId],
  );

  const { table, selectedIds, resetSelection } =
    useDataTable<AdminAlertListItem>({
      data: rows,
      columns,
      pageCount,
      getRowId: (r) => r.id,
    });

  const refresh = () =>
    queryClient.invalidateQueries(trpc.adminNotifications.pathFilter());

  const markRead = useMutation({
    ...trpc.adminNotifications.markRead.mutationOptions(),
    onSuccess: refresh,
  });
  const archive = useMutation({
    ...trpc.adminNotifications.archive.mutationOptions(),
    onSuccess: () => {
      resetSelection();
      void refresh();
      toast.success(t("archived"));
    },
  });
  const unarchive = useMutation({
    ...trpc.adminNotifications.unarchive.mutationOptions(),
    onSuccess: () => {
      resetSelection();
      void refresh();
      toast.success(t("unarchived"));
    },
  });

  const detail = rows.find((r) => r.id === detailId);

  // Opening an alert is reading it. Keyed on the id (not the object) so the
  // refetch that follows — which flips `readAt` — doesn't re-fire this.
  const markedOnOpen = useRef<string | null>(null);
  useEffect(() => {
    if (!detail || detail.readAt) return;
    if (markedOnOpen.current === detail.id) return;
    markedOnOpen.current = detail.id;
    markRead.mutate({ id: detail.id });
  }, [detail, markRead]);

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("total", { count: total })}
          </p>
        </div>
      </div>

      <div className="border-border mt-5 flex items-center gap-5 border-b">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              void setTab(value);
              resetPage();
            }}
            className={`relative -mb-px border-b-2 py-3 text-sm font-semibold transition-colors ${
              tab === value
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(value)}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full max-w-xs rounded-lg"
        />
        <DataTableFilters activeCount={activeFacets} onClear={clearFilters}>
          <FilterSection label={t("colType")}>
            {ALERT_TYPE_VALUES.map((v) => (
              <label
                key={v}
                className="flex cursor-pointer items-center gap-2.5 text-sm"
              >
                <Checkbox
                  checked={type.includes(v)}
                  onCheckedChange={() =>
                    toggle(type, (next) => void setType(next), v)
                  }
                />
                {tt(v)}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("colSeverity")}>
            {SEVERITY_VALUES.map((v) => (
              <label
                key={v}
                className="flex cursor-pointer items-center gap-2.5 text-sm"
              >
                <Checkbox
                  checked={severity.includes(v)}
                  onCheckedChange={() =>
                    toggle(severity, (next) => void setSeverity(next), v)
                  }
                />
                {ts(v)}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("colStatus")}>
            {READ_STATES.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  void setRead(read === v ? null : v);
                  resetPage();
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 text-left text-sm"
              >
                <span
                  className={`grid size-4 place-items-center rounded-full border ${
                    read === v ? "border-primary" : "border-muted-foreground/40"
                  }`}
                >
                  {read === v ? (
                    <span className="bg-primary size-2 rounded-full" />
                  ) : null}
                </span>
                {t(v)}
              </button>
            ))}
          </FilterSection>

          <FilterSection label={t("colWhen")}>
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
          </FilterSection>
        </DataTableFilters>
        <div className="ml-auto flex items-center gap-2">
          <DataTableSortList table={table} />
          <DataTableViewOptions table={table} />
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
                <p className="text-foreground font-semibold">
                  {tab === "inbox" ? t("empty") : t("archiveEmpty")}
                </p>
              </div>
            </div>
          }
        />
        <DataTablePagination
          table={table}
          total={total}
          selectedCount={selectedIds.length}
        />
      </div>

      <DataTableBulkBar count={selectedIds.length} onClear={resetSelection}>
        {tab === "inbox" ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 rounded-full"
            disabled={archive.isPending}
            onClick={() => archive.mutate({ ids: selectedIds })}
          >
            <Archive className="size-4" />
            {t("archiveSelected")}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 rounded-full"
            disabled={unarchive.isPending}
            onClick={() => unarchive.mutate({ ids: selectedIds })}
          >
            <ArchiveRestore className="size-4" />
            {t("unarchive")}
          </Button>
        )}
      </DataTableBulkBar>

      <ResponsiveModal
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) void setDetailId(null);
        }}
      >
        <ResponsiveModalContent
          showCloseButton={false}
          mobileClassName="mx-auto w-full max-w-md"
          desktopClassName="sm:max-w-lg p-0 overflow-hidden"
        >
          <ResponsiveModalTitle className="sr-only">
            {detail?.title ?? t("title")}
          </ResponsiveModalTitle>
          {detail ? (
            <AlertDetail
              alert={detail}
              onNavigate={() => void setDetailId(null)}
              onArchive={() => {
                archive.mutate({ ids: [detail.id] });
                void setDetailId(null);
              }}
              onUnarchive={() => {
                unarchive.mutate({ ids: [detail.id] });
                void setDetailId(null);
              }}
            />
          ) : null}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}

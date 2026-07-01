"use client";

import type {
  CampaignDisplayState,
  CampaignListItem,
  CampaignsListInput,
} from "@loyalty/api/features/campaigns/schemas";
import { formatDate, localeFromCode } from "@loyalty/date";
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
import {
  Bell,
  Download,
  Mail,
  MessageCircle,
  MessageSquare,
  Plus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
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

import { buildCampaignsInput } from "../list-params";
import { CampaignDetailModal } from "./campaign-detail-modal";
import { CampaignRowActions } from "./campaign-row-actions";

const TYPE_VALUES = ["promotional", "automated", "transactional"] as const;
const STATE_VALUES: CampaignDisplayState[] = [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "paused",
];

const STATE_STYLE: Record<CampaignDisplayState, string> = {
  sent: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  sending: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  paused: "bg-muted text-muted-foreground",
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

const CHANNEL_ICON: Record<string, LucideIcon> = {
  push: Bell,
  email: Mail,
  sms: MessageSquare,
  whatsapp: MessageCircle,
};

type CampaignsListResult = { rows: CampaignListItem[]; total: number; pageCount: number };

function ChannelIcons({ channels }: { channels: string[] }) {
  if (channels.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-1">
      {channels.map((c) => {
        const Icon = CHANNEL_ICON[c];
        if (!Icon) return null;
        return (
          <span
            key={c}
            className="bg-muted text-muted-foreground grid size-6 place-items-center rounded-md"
          >
            <Icon className="size-3" />
          </span>
        );
      })}
    </div>
  );
}

export function CampaignsView({ initialData }: { initialData?: CampaignsListResult }) {
  const t = useTranslations("Campaigns");
  const locale = useLocale();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [q, setQ] = useQueryState("q", tableParsers.q);
  const [type, setType] = useQueryState("type", parseAsArrayOf(parseAsString).withDefault([]));
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
    (type.length > 0 && type.length < TYPE_VALUES.length ? 1 : 0) +
    (state.length > 0 && state.length < STATE_VALUES.length ? 1 : 0) +
    (from || to ? 1 : 0);
  const clearFilters = () => {
    void setType([]);
    void setState([]);
    void setFrom(null);
    void setTo(null);
    resetPage();
  };
  const toggleType = (v: string) => {
    void setType(type.includes(v) ? type.filter((x) => x !== v) : [...type, v]);
    resetPage();
  };
  const toggleState = (v: string) => {
    void setState(state.includes(v) ? state.filter((x) => x !== v) : [...state, v]);
    resetPage();
  };

  const input: CampaignsListInput = useMemo(
    () => buildCampaignsInput({ q, page, perPage, sort, type, state, from, to }),
    [q, page, perPage, sort, type, state, from, to],
  );

  const initialKey = useRef(JSON.stringify(input));
  const useInitial = initialData && JSON.stringify(input) === initialKey.current;
  const query = useQuery(
    trpc.campaigns.adminList.queryOptions(input, {
      placeholderData: keepPreviousData,
      ...(useInitial ? { initialData } : {}),
    }),
  );
  const rows = query.data?.rows ?? [];
  const pageCount = query.data?.pageCount ?? 1;
  const total = query.data?.total ?? 0;

  const columns = useMemo<ColumnDef<CampaignListItem, unknown>[]>(
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
            <span className="line-clamp-1">{row.original.name || t("namePlaceholder")}</span>
          </button>
        ),
      },
      {
        accessorKey: "type",
        enableSorting: false,
        meta: { label: t("colType") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("colType")}</span>,
        cell: ({ row }) => (
          <Badge variant="outline">{t(`type.${row.original.type}`)}</Badge>
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
        accessorKey: "channelPriority",
        enableSorting: false,
        meta: { label: t("colChannels") },
        header: () => (
          <span className="text-muted-foreground text-xs font-bold">{t("colChannels")}</span>
        ),
        cell: ({ row }) => <ChannelIcons channels={row.original.channelPriority} />,
      },
      {
        accessorKey: "sent",
        meta: { label: t("colSent") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("colSent")} />,
        cell: ({ row }) =>
          row.original.sent > 0 ? (
            <span className="font-semibold">{row.original.sent.toLocaleString()}</span>
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
        cell: ({ row }) => <CampaignRowActions campaign={row.original} />,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, locale, setDetailId],
  );

  const { table, selectedIds, resetSelection } = useDataTable<CampaignListItem>({
    data: rows,
    columns,
    pageCount,
    getRowId: (r) => r.id,
  });

  const invalidate = () => queryClient.invalidateQueries(trpc.campaigns.adminList.queryFilter());
  const bulkRemove = useMutation(trpc.campaigns.bulkRemove.mutationOptions());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const onExport = async () => {
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
        <Button className="h-10 gap-1.5 rounded-xl" onClick={() => router.push("/campaigns/new")}>
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
          <FilterSection label={t("colType")}>
            {TYPE_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={type.includes(v)} onCheckedChange={() => toggleType(v)} />
                {t(`type.${v}`)}
              </label>
            ))}
          </FilterSection>

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
              {items.map((c) => (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  className="bg-card border-border hover:border-primary/40 flex cursor-pointer flex-col rounded-3xl border p-5 shadow-sm transition-colors"
                  onClick={() => void setDetailId(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void setDetailId(c.id);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{c.name || t("namePlaceholder")}</p>
                    <div
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <CampaignRowActions campaign={c} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    <Badge className={`border-0 ${STATE_STYLE[c.displayState]}`}>
                      {t(`state.${c.displayState}`)}
                    </Badge>
                    <Badge variant="outline">{t(`type.${c.type}`)}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <ChannelIcons channels={c.channelPriority} />
                    <span className="text-muted-foreground text-xs font-semibold">
                      {c.sent > 0 ? t("sentN", { n: c.sent }) : formatDate(c.createdAt, { locale })}
                    </span>
                  </div>
                  <div
                    className="mt-3"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={table.getRow(c.id)?.getIsSelected() ?? false}
                      onCheckedChange={(v) => table.getRow(c.id)?.toggleSelected(!!v)}
                      aria-label={t("selectRow")}
                    />
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

      <CampaignDetailModal id={detailId} onClose={() => void setDetailId(null)} />
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
  const t = useTranslations("Campaigns");
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

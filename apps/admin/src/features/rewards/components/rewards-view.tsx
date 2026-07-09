"use client";

import type { AdminRewardRow } from "@loyalty/api/features/rewards";
import type { RewardAdminListInput } from "@loyalty/api/features/rewards/schemas";
import { formatDate } from "@loyalty/date";
import { Badge, Button, Checkbox, IconGlyph, Input } from "@loyalty/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import {
  DataTable,
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
import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import {
  buildRewardsInput,
  REWARD_STATUS_VALUES,
  REWARD_TYPE_VALUES,
} from "../list-params";
import { RewardRowActions } from "./reward-row-actions";

type RewardListResult = { rows: AdminRewardRow[]; total: number; pageCount: number };

export function RewardsView({ initialData }: { initialData?: RewardListResult }) {
  const t = useTranslations("Rewards");
  const locale = useLocale();
  const trpc = useTRPC();
  const router = useRouter();

  // Feature-specific URL state (facets + q). page/perPage/sort/view/cols live in
  // useDataTable.
  const [q, setQ] = useQueryState("q", tableParsers.q);
  const [status, setStatus] = useQueryState("status", parseAsArrayOf(parseAsString).withDefault([]));
  const [type, setType] = useQueryState("type", parseAsArrayOf(parseAsString).withDefault([]));
  const [page, setPage] = useQueryState("page", tableParsers.page);
  const [perPage] = useQueryState("perPage", tableParsers.perPage);
  const [sort] = useQueryState("sort", tableParsers.sort);
  const [view, setView] = useQueryState("view", tableParsers.view);

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

  const narrows = (values: string[], all: readonly string[]) =>
    values.length > 0 && values.length < all.length ? 1 : 0;
  const activeFacets = narrows(status, REWARD_STATUS_VALUES) + narrows(type, REWARD_TYPE_VALUES);
  const clearFilters = () => {
    void setStatus([]);
    void setType([]);
    resetPage();
  };
  const toggle = (values: string[], set: (next: string[]) => void) => (v: string) => {
    set(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
    resetPage();
  };
  const toggleStatus = toggle(status, (next) => void setStatus(next));
  const toggleType = toggle(type, (next) => void setType(next));

  const input: RewardAdminListInput = useMemo(
    () => buildRewardsInput({ q, page, perPage, sort, status, type }),
    [q, page, perPage, sort, status, type],
  );

  const initialKey = useRef(JSON.stringify(input));
  const useInitial = initialData && JSON.stringify(input) === initialKey.current;
  const query = useQuery(
    trpc.rewards.adminList.queryOptions(input, {
      placeholderData: keepPreviousData,
      ...(useInitial ? { initialData } : {}),
    }),
  );
  const rows = query.data?.rows ?? [];
  const pageCount = query.data?.pageCount ?? 1;
  const total = query.data?.total ?? 0;

  const openDetail = (id: string) => router.push({ pathname: "/rewards/[id]", params: { id } });

  const typeLabel = (v: string | null) =>
    v && (REWARD_TYPE_VALUES as readonly string[]).includes(v) ? t(`types.${v}`) : "—";
  const statusBadge = (s: string) =>
    s === "published" ? (
      <Badge>{t("list.published")}</Badge>
    ) : s === "archived" ? (
      <Badge variant="secondary">{t("list.archived")}</Badge>
    ) : (
      <Badge variant="outline">{t("list.draft")}</Badge>
    );
  const costLabel = (r: AdminRewardRow) => {
    const parts: string[] = [];
    if (r.stampsRequired != null) parts.push(t("cost.stamps", { n: r.stampsRequired }));
    if (r.pointsCost != null) parts.push(t("cost.points", { n: r.pointsCost }));
    if (parts.length === 0) return "—";
    return parts.join(r.costMode === "and" ? t("cost.and") : t("cost.or"));
  };

  const columns = useMemo<ColumnDef<AdminRewardRow, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        meta: { label: t("list.colName") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("list.colName")} />,
        cell: ({ row }) => (
          <span className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="border-border grid size-7 shrink-0 place-items-center rounded-lg border text-sm text-white"
              style={{ background: row.original.backgroundCss ?? "var(--muted)" }}
            >
              {row.original.icon ? <IconGlyph value={row.original.icon} /> : null}
            </span>
            <span className="font-semibold">{row.original.name || t("list.namePlaceholder")}</span>
          </span>
        ),
      },
      {
        accessorKey: "type",
        enableSorting: false,
        meta: { label: t("list.colType") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("list.colType")}</span>,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">{typeLabel(row.original.type)}</span>
        ),
      },
      {
        accessorKey: "status",
        enableSorting: false,
        meta: { label: t("list.colStatus") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("list.colStatus")}</span>,
        cell: ({ row }) => statusBadge(row.original.status),
      },
      {
        id: "cost",
        enableSorting: false,
        meta: { label: t("list.colCost") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("list.colCost")}</span>,
        cell: ({ row }) => (
          <span className="text-primary text-sm font-semibold">{costLabel(row.original)}</span>
        ),
      },
      {
        accessorKey: "redemptions",
        meta: { label: t("list.colRedemptions") },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("list.colRedemptions")} />
        ),
        cell: ({ row }) => (
          <span className="text-sm tabular-nums">{row.original.redemptions}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        meta: { label: t("list.colCreated") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("list.colCreated")} />,
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
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <RewardRowActions reward={row.original} />
          </div>
        ),
      },
    ],
    [t, locale],
  );

  const { table, selectedIds } = useDataTable<AdminRewardRow>({
    data: rows,
    columns,
    pageCount,
    getRowId: (r) => r.id,
  });

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button className="h-10 gap-1.5 rounded-xl" onClick={() => router.push("/rewards/new")}>
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
          <FilterSection label={t("list.colStatus")}>
            {REWARD_STATUS_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={status.includes(v)} onCheckedChange={() => toggleStatus(v)} />
                {t(`list.${v}`)}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("list.colType")}>
            {REWARD_TYPE_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={type.includes(v)} onCheckedChange={() => toggleType(v)} />
                {t(`types.${v}`)}
              </label>
            ))}
          </FilterSection>
        </DataTableFilters>
        <div className="ml-auto flex items-center gap-2">
          <DataTableSortList table={table} />
          <DataTableViewOptions table={table} />
          <ViewToggle value={view} onValueChange={(v) => setView(v)} ariaLabel={t("list.viewToggle")} />
        </div>
      </div>

      <div className="mt-4">
        <DataTable
          table={table}
          view={view}
          isFetching={query.isFetching}
          onRowClick={(r) => openDetail(r.id)}
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
              {items.map((r) => (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  className="bg-card border-border hover:border-primary/40 flex cursor-pointer flex-col overflow-hidden rounded-3xl border shadow-sm transition-colors"
                  onClick={() => openDetail(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openDetail(r.id);
                    }
                  }}
                >
                  <div
                    className="relative flex h-24 items-center justify-center text-4xl text-white"
                    style={{ background: r.backgroundCss ?? "var(--muted)" }}
                  >
                    {r.icon ? <IconGlyph value={r.icon} /> : null}
                    <div
                      className="absolute top-3 right-3"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <RewardRowActions reward={r} />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{r.name || t("list.namePlaceholder")}</p>
                      {statusBadge(r.status)}
                    </div>
                    <div className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
                      <span>{typeLabel(r.type)}</span>
                      <span aria-hidden>·</span>
                      <span className="text-primary font-semibold">{costLabel(r)}</span>
                      <span aria-hidden>·</span>
                      <span className="tabular-nums">{t("list.redemptionsCount", { n: r.redemptions })}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        />
        <DataTablePagination table={table} total={total} selectedCount={selectedIds.length} />
      </div>
    </div>
  );
}

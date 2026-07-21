"use client";

import type { CustomerListItem, CustomersListInput } from "@loyalty/api/features/customers/schemas";
import { formatDate, localeFromCode } from "@loyalty/date";
import { Badge, Button, Calendar, Checkbox, Input } from "@loyalty/ui";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Plus } from "lucide-react";
import { parseAsArrayOf, parseAsInteger, parseAsIsoDate, parseAsString, useQueryState } from "nuqs";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { useRouter } from "@/i18n/nav";
import { money } from "@/lib/money";
import { useTRPC } from "@/lib/trpc/client";

import { customerInitials } from "../lib/initials";
import { buildCustomersInput, STATUS_VALUES, TIER_VALUES } from "../list-params";

type CustomerListResult = { rows: CustomerListItem[]; total: number; pageCount: number };

const THIRTY_DAYS = 30 * 86_400_000;

function statusOf(c: CustomerListItem): "banned" | "active" | "inactive" {
  if (c.banned) return "banned";
  if (c.lastVisitAt && Date.now() - new Date(c.lastVisitAt).getTime() <= THIRTY_DAYS) return "active";
  return "inactive";
}

export function CustomersView({ initialData }: { initialData?: CustomerListResult }) {
  const t = useTranslations("Customers");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const openDetail = useCallback(
    (id: string) => router.push({ pathname: "/customers/[id]", params: { id } }),
    [router],
  );

  const [q, setQ] = useQueryState("q", tableParsers.q);
  const [tier, setTier] = useQueryState("tier", parseAsArrayOf(parseAsString).withDefault([]));
  const [status, setStatus] = useQueryState("status", parseAsArrayOf(parseAsString).withDefault([]));
  const [from, setFrom] = useQueryState("from", parseAsIsoDate);
  const [to, setTo] = useQueryState("to", parseAsIsoDate);
  const [spendMin, setSpendMin] = useQueryState("spendMin", parseAsInteger);
  const [spendMax, setSpendMax] = useQueryState("spendMax", parseAsInteger);
  const [, setPage] = useQueryState("page", tableParsers.page);
  const [sort] = useQueryState("sort", tableParsers.sort);
  const [page] = useQueryState("page", tableParsers.page);
  const [perPage] = useQueryState("perPage", tableParsers.perPage);
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

  const isTierFacet = tier.length > 0 && tier.length < TIER_VALUES.length;
  const isStatusFacet = status.length > 0 && status.length < STATUS_VALUES.length;
  const activeFacets =
    (isTierFacet ? 1 : 0) +
    (isStatusFacet ? 1 : 0) +
    (from || to ? 1 : 0) +
    (spendMin != null || spendMax != null ? 1 : 0);
  const clearFilters = () => {
    void setTier([]);
    void setStatus([]);
    void setFrom(null);
    void setTo(null);
    void setSpendMin(null);
    void setSpendMax(null);
    resetPage();
  };
  const toggle = (values: string[], setter: (v: string[]) => void, v: string) => {
    setter(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
    resetPage();
  };

  const input: CustomersListInput = useMemo(
    () => buildCustomersInput({ q, page, perPage, sort, tier, status, from, to, spendMin, spendMax }),
    [q, page, perPage, sort, tier, status, from, to, spendMin, spendMax],
  );

  const initialKey = useRef(JSON.stringify(input));
  const useInitial = initialData && JSON.stringify(input) === initialKey.current;
  const query = useQuery(
    trpc.customers.adminList.queryOptions(input, {
      placeholderData: keepPreviousData,
      ...(useInitial ? { initialData } : {}),
    }),
  );
  const kpisQuery = useQuery(trpc.customers.adminKpis.queryOptions(undefined, { placeholderData: keepPreviousData }));
  const rows = query.data?.rows ?? [];
  const pageCount = query.data?.pageCount ?? 1;
  const total = query.data?.total ?? 0;

  const columns = useMemo<ColumnDef<CustomerListItem, unknown>[]>(
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
        meta: { label: t("col.customer") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("col.customer")} />,
        cell: ({ row }) => (
          <button
            type="button"
            className="hover:text-primary flex cursor-pointer items-center gap-2.5 text-left hover:underline"
            onClick={() => openDetail(row.original.id)}
          >
            <span className="bg-primary/10 text-primary grid size-8 flex-none place-items-center rounded-full text-xs font-bold">
              {customerInitials(row.original.name, row.original.phone)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{row.original.name || row.original.phone}</span>
              <span className="text-muted-foreground block truncate text-xs">{row.original.phone}</span>
            </span>
          </button>
        ),
      },
      {
        accessorKey: "tierKey",
        enableSorting: false,
        meta: { label: t("col.tier") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("col.tier")}</span>,
        cell: ({ row }) => <Badge variant="outline">{t(`tier.${row.original.tierKey ?? "hoja"}`)}</Badge>,
      },
      {
        accessorKey: "visits",
        meta: { label: t("col.visits") },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("col.visits")} className="justify-end" />
        ),
        cell: ({ row }) => <div className="text-right text-sm">{row.original.visits}</div>,
      },
      {
        accessorKey: "ltv",
        meta: { label: t("col.spent") },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("col.spent")} className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right font-bold whitespace-nowrap">{money(format, row.original.ltvCents)}</div>
        ),
      },
      {
        accessorKey: "lastVisit",
        meta: { label: t("col.lastVisit") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("col.lastVisit")} />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {row.original.lastVisitAt ? formatDate(row.original.lastVisitAt, { locale }) : "—"}
          </span>
        ),
      },
      {
        id: "status",
        enableSorting: false,
        meta: { label: t("col.status") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("col.status")}</span>,
        cell: ({ row }) => {
          const s = statusOf(row.original);
          return (
            <Badge
              variant={s === "banned" ? "destructive" : s === "active" ? "default" : "secondary"}
            >
              {t(`status.${s}`)}
            </Badge>
          );
        },
      },
    ],
    [t, locale, format, openDetail],
  );

  const { table, selectedIds, resetSelection } = useDataTable<CustomerListItem>({
    data: rows,
    columns,
    pageCount,
    getRowId: (r) => r.id,
  });

  const onExport = async () => {
    const data = await queryClient.fetchQuery(trpc.customers.adminListByIds.queryOptions({ ids: selectedIds }));
    downloadCsv(
      rowsToCsv(data, [
        { header: t("col.customer"), value: (c) => c.name ?? c.phone },
        { header: t("col.phone"), value: (c) => c.phone },
        { header: "Email", value: (c) => c.email ?? "" },
        { header: t("col.tier"), value: (c) => c.tierKey ?? "" },
        { header: t("col.visits"), value: (c) => String(c.visits) },
        { header: t("col.spent"), value: (c) => String(c.ltvCents / 100) },
        { header: t("col.lastVisit"), value: (c) => (c.lastVisitAt ? formatDate(c.lastVisitAt, { locale }) : "") },
      ]),
      `clientes-${new Date().toISOString().slice(0, 10)}.csv`,
    );
    toast.success(t("exported", { n: selectedIds.length }));
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button className="h-10 gap-1.5 rounded-xl" onClick={() => router.push("/customers/new")}>
          <Plus className="size-4" />
          {t("addCustomer")}
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t("kpi.total")} value={String(kpisQuery.data?.total ?? 0)} />
        <Kpi label={t("kpi.new30d")} value={String(kpisQuery.data?.new30d ?? 0)} />
        <Kpi label={t("kpi.active30d")} value={String(kpisQuery.data?.active30d ?? 0)} />
        <Kpi label={t("kpi.avgLtv")} value={money(format, kpisQuery.data?.avgLtvCents ?? 0)} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full sm:w-64"
        />
        <DataTableFilters activeCount={activeFacets} onClear={clearFilters}>
          <FilterSection label={t("col.tier")}>
            {TIER_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={tier.includes(v)} onCheckedChange={() => toggle(tier, setTier, v)} />
                {t(`tier.${v}`)}
              </label>
            ))}
          </FilterSection>
          <FilterSection label={t("col.status")}>
            {STATUS_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={status.includes(v)} onCheckedChange={() => toggle(status, setStatus, v)} />
                {t(`status.${v}`)}
              </label>
            ))}
          </FilterSection>
          <FilterSection label={t("spendRange")}>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                placeholder={t("min")}
                className="h-9"
                value={spendMin ?? ""}
                onChange={(e) => {
                  void setSpendMin(e.target.value ? Number(e.target.value) : null);
                  resetPage();
                }}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                inputMode="numeric"
                placeholder={t("max")}
                className="h-9"
                value={spendMax ?? ""}
                onChange={(e) => {
                  void setSpendMax(e.target.value ? Number(e.target.value) : null);
                  resetPage();
                }}
              />
            </div>
          </FilterSection>
          <FilterSection label={t("col.joined")}>
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
                <button
                  key={c.id}
                  type="button"
                  className="bg-card border-border hover:border-primary/40 cursor-pointer rounded-3xl border p-4 text-left shadow-sm transition-colors"
                  onClick={() => openDetail(c.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className="bg-primary/10 text-primary grid size-10 flex-none place-items-center rounded-full text-sm font-bold">
                      {customerInitials(c.name, c.phone)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{c.name || c.phone}</div>
                      <div className="text-muted-foreground truncate text-xs">{c.phone}</div>
                    </div>
                    <Badge variant="outline">{t(`tier.${c.tierKey ?? "hoja"}`)}</Badge>
                  </div>
                  <div className="border-border mt-4 grid grid-cols-2 gap-2 border-t pt-4">
                    <div>
                      <div className="font-bold">{money(format, c.ltvCents)}</div>
                      <div className="text-muted-foreground text-xs">{t("col.spent")}</div>
                    </div>
                    <div>
                      <div className="font-bold">{c.visits}</div>
                      <div className="text-muted-foreground text-xs">{t("col.visits")}</div>
                    </div>
                  </div>
                </button>
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
      </DataTableBulkBar>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border-border min-w-0 rounded-3xl border p-5 shadow-sm">
      <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">{label}</span>
      <div className="font-display mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

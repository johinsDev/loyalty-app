"use client";

import type {
  PurchaseAdminListItem,
  PurchasesAdminListInput,
} from "@loyalty/api/features/purchases/schemas";
import { formatDate, localeFromCode } from "@loyalty/date";
import { Badge, Button, Calendar, Checkbox, Input } from "@loyalty/ui";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Gift, Tag } from "lucide-react";
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
import { useStoreScope } from "@/lib/store-scope";
import { money } from "@/lib/money";
import { useTRPC } from "@/lib/trpc/client";

import {
  buildPurchasesInput,
  EFFECTIVENESS_VALUES,
  ENTRY_SOURCE_VALUES,
  REDEMPTION_CURRENCY_VALUES,
} from "../list-params";
import { CustomerFilter } from "./customer-filter";
import { PurchaseRowActions } from "./purchase-row-actions";

type PurchaseListResult = { rows: PurchaseAdminListItem[]; total: number; pageCount: number };

export function PurchasesView({ initialData }: { initialData?: PurchaseListResult }) {
  const t = useTranslations("Purchases");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { storeId: scopeStoreId } = useStoreScope();
  const openDetail = useCallback(
    (id: string) => router.push({ pathname: "/purchases/[id]", params: { id } }),
    [router],
  );

  // ── URL state (facets + q). page/perPage/sort/view/cols live in useDataTable.
  const [q, setQ] = useQueryState("q", tableParsers.q);
  const [store, setStore] = useQueryState("store", parseAsArrayOf(parseAsString).withDefault([]));
  const [cashier, setCashier] = useQueryState("cashier", parseAsArrayOf(parseAsString).withDefault([]));
  const [effectiveness, setEffectiveness] = useQueryState(
    "effectiveness",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [currency, setCurrency] = useQueryState("currency", parseAsArrayOf(parseAsString).withDefault([]));
  const [entry, setEntry] = useQueryState("entry", parseAsArrayOf(parseAsString).withDefault([]));
  const [customer, setCustomer] = useQueryState(
    "customer",
    parseAsArrayOf(parseAsString).withDefault([]),
  );
  const [amountMin, setAmountMin] = useQueryState("amountMin", parseAsInteger);
  const [amountMax, setAmountMax] = useQueryState("amountMax", parseAsInteger);
  const [from, setFrom] = useQueryState("from", parseAsIsoDate);
  const [to, setTo] = useQueryState("to", parseAsIsoDate);
  const [, setPage] = useQueryState("page", tableParsers.page);
  const [sort] = useQueryState("sort", tableParsers.sort);
  const [page] = useQueryState("page", tableParsers.page);
  const [perPage] = useQueryState("perPage", tableParsers.perPage);
  const [view, setView] = useQueryState("view", tableParsers.view);

  const resetPage = () => void setPage(1);

  // Debounced search box (customer name / phone) → URL `q`.
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

  // Facet option lists (small; the pilot has few stores/cashiers).
  const storesQuery = useQuery(
    trpc.stores.list.queryOptions({ page: 1, perPage: 100, sort: [] }),
  );
  const employeesQuery = useQuery(
    trpc.employees.list.queryOptions({ page: 1, perPage: 100, sort: [] }),
  );
  const storeOptions = (storesQuery.data?.rows ?? []).map((s) => ({ id: s.id, name: s.name }));
  const cashierOptions = (employeesQuery.data?.rows ?? [])
    .filter((e): e is typeof e & { userId: string } => !!e.userId)
    .map((e) => ({ id: e.userId, name: e.name ?? e.email ?? e.userId }));

  const isEffFacet = effectiveness.length > 0 && effectiveness.length < EFFECTIVENESS_VALUES.length;
  const isCurFacet = currency.length > 0 && currency.length < REDEMPTION_CURRENCY_VALUES.length;
  const isEntryFacet = entry.length > 0 && entry.length < ENTRY_SOURCE_VALUES.length;
  // The customer combobox lives in the toolbar next to the search box, not in
  // the drawer — so it neither counts toward the badge nor clears with it.
  const activeFacets =
    (store.length > 0 ? 1 : 0) +
    (cashier.length > 0 ? 1 : 0) +
    (isEffFacet ? 1 : 0) +
    (isCurFacet ? 1 : 0) +
    (isEntryFacet ? 1 : 0) +
    (amountMin != null || amountMax != null ? 1 : 0) +
    (from || to ? 1 : 0);

  const clearFilters = () => {
    void setStore([]);
    void setCashier([]);
    void setEffectiveness([]);
    void setCurrency([]);
    void setEntry([]);
    void setAmountMin(null);
    void setAmountMax(null);
    void setFrom(null);
    void setTo(null);
    resetPage();
  };
  const toggle = (
    values: string[],
    setter: (v: string[]) => void,
    v: string,
  ) => {
    setter(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
    resetPage();
  };

  const input: PurchasesAdminListInput = useMemo(
    () =>
      buildPurchasesInput({
        q,
        page,
        perPage,
        sort,
        // Scoped to a store → hard-filter to it (the manual store facet is
        // hidden in that view); "all" → honor the manual store filter.
        store: scopeStoreId ? [scopeStoreId] : store,
        cashier,
        effectiveness,
        currency,
        entry,
        customer,
        amountMin,
        amountMax,
        from,
        to,
      }),
    [q, page, perPage, sort, scopeStoreId, store, cashier, effectiveness, currency, entry, customer, amountMin, amountMax, from, to],
  );

  const initialKey = useRef(JSON.stringify(input));
  const useInitial = initialData && JSON.stringify(input) === initialKey.current;
  const query = useQuery(
    trpc.purchases.adminList.queryOptions(input, {
      placeholderData: keepPreviousData,
      ...(useInitial ? { initialData } : {}),
    }),
  );
  const kpisQuery = useQuery(
    trpc.purchases.adminKpis.queryOptions(input, { placeholderData: keepPreviousData }),
  );
  const rows = query.data?.rows ?? [];
  const pageCount = query.data?.pageCount ?? 1;
  const total = query.data?.total ?? 0;

  const columns = useMemo<ColumnDef<PurchaseAdminListItem, unknown>[]>(
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
        accessorKey: "createdAt",
        meta: { label: t("col.date") },
        header: ({ column }) => <DataTableColumnHeader column={column} title={t("col.date")} />,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm whitespace-nowrap">
            {formatDate(row.original.createdAt, { locale })}
          </span>
        ),
      },
      {
        accessorKey: "customerName",
        enableSorting: false,
        meta: { label: t("col.customer") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("col.customer")}</span>,
        cell: ({ row }) => (
          <button
            type="button"
            className="hover:text-primary flex cursor-pointer items-center gap-2.5 text-left hover:underline"
            onClick={() => openDetail(row.original.id)}
          >
            <span className="bg-primary/10 text-primary grid size-8 flex-none place-items-center rounded-full text-xs font-bold">
              {(row.original.customerName ?? row.original.customerPhone).slice(0, 2).toUpperCase()}
            </span>
            <span
              className={`truncate font-semibold ${row.original.voidedAt ? "text-muted-foreground line-through" : ""}`}
            >
              {row.original.customerName || row.original.customerPhone}
            </span>
          </button>
        ),
      },
      {
        id: "flags",
        enableSorting: false,
        meta: { label: t("col.flags") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("col.flags")}</span>,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            {row.original.voidedAt ? (
              <Badge variant="destructive">{t("voided")}</Badge>
            ) : null}
            {row.original.hasPromo ? (
              <Badge variant="secondary" className="gap-1">
                <Tag className="size-3" />
                {t("badgePromo")}
              </Badge>
            ) : null}
            {row.original.hasReward ? (
              <Badge variant="secondary" className="gap-1">
                <Gift className="size-3" />
                {t("badgeReward")}
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        accessorKey: "itemSummary",
        enableSorting: false,
        meta: { label: t("col.detail") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("col.detail")}</span>,
        cell: ({ row }) =>
          row.original.itemSummary ? (
            <span className="text-muted-foreground text-sm">{row.original.itemSummary}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "storeName",
        enableSorting: false,
        meta: { label: t("col.store") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("col.store")}</span>,
        cell: ({ row }) =>
          row.original.storeName ? (
            <Badge variant="outline">{row.original.storeName}</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        accessorKey: "cashierName",
        enableSorting: false,
        meta: { label: t("col.cashier") },
        header: () => <span className="text-muted-foreground text-xs font-bold">{t("col.cashier")}</span>,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-sm">{row.original.cashierName ?? "—"}</span>
        ),
      },
      {
        accessorKey: "discountCents",
        meta: { label: t("col.discount") },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("col.discount")} className="justify-end" />
        ),
        cell: ({ row }) => (
          <div className="text-right text-sm font-semibold">
            {row.original.discountCents > 0 ? (
              <span className="text-primary">−{money(format, row.original.discountCents, row.original.currency)}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "totalCents",
        meta: { label: t("col.amount") },
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t("col.amount")} className="justify-end" />
        ),
        cell: ({ row }) => (
          <div
            className={`text-right font-bold whitespace-nowrap ${row.original.voidedAt ? "text-muted-foreground line-through" : ""}`}
          >
            {money(format, row.original.totalCents, row.original.currency)}
          </div>
        ),
      },
      {
        accessorKey: "stampsEarned",
        enableSorting: false,
        meta: { label: t("col.stamps") },
        header: () => (
          <span className="text-muted-foreground block text-right text-xs font-bold">{t("col.stamps")}</span>
        ),
        cell: ({ row }) => (
          <div className="text-right text-sm font-semibold">
            {row.original.stampsEarned > 0 ? `+${row.original.stampsEarned}` : "—"}
          </div>
        ),
      },
      {
        accessorKey: "pointsEarned",
        enableSorting: false,
        meta: { label: t("col.points") },
        header: () => (
          <span className="text-muted-foreground block text-right text-xs font-bold">{t("col.points")}</span>
        ),
        cell: ({ row }) => (
          <div
            className={`text-right text-sm font-semibold ${row.original.voidedAt ? "text-muted-foreground line-through" : "text-emerald-600"}`}
          >
            {row.original.pointsEarned > 0 ? `+${row.original.pointsEarned}` : "—"}
          </div>
        ),
      },
      {
        id: "actions",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => <PurchaseRowActions id={row.original.id} />,
      },
    ],
    [t, locale, format, openDetail],
  );

  const { table, selectedIds, resetSelection } = useDataTable<PurchaseAdminListItem>({
    data: rows,
    columns,
    pageCount,
    getRowId: (r) => r.id,
  });

  const onExport = async () => {
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
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
      </div>

      {/* KPI row (honors the active filters). */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t("kpi.count")} value={String(kpisQuery.data?.count ?? 0)} />
        <Kpi
          label={t("kpi.revenue")}
          value={money(format, kpisQuery.data?.netRevenueCents ?? 0)}
        />
        <Kpi
          label={t("kpi.avgTicket")}
          value={money(format, kpisQuery.data?.avgTicketCents ?? 0)}
        />
        <Kpi
          label={t("kpi.promoRate")}
          value={`${Math.round((kpisQuery.data?.promoRate ?? 0) * 100)}%`}
        />
      </div>

      {/* Toolbar. */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-10 w-full sm:w-64"
        />
        <CustomerFilter
          value={customer}
          onChange={(ids) => {
            void setCustomer(ids.length > 0 ? ids : null);
            resetPage();
          }}
        />
        <DataTableFilters activeCount={activeFacets} onClear={clearFilters}>
          <FilterSection label={t("col.store")}>
            {storeOptions.length === 0 ? (
              <span className="text-muted-foreground text-sm">{t("noStores")}</span>
            ) : (
              storeOptions.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox checked={store.includes(s.id)} onCheckedChange={() => toggle(store, setStore, s.id)} />
                  {s.name}
                </label>
              ))
            )}
          </FilterSection>

          <FilterSection label={t("col.cashier")}>
            {cashierOptions.length === 0 ? (
              <span className="text-muted-foreground text-sm">{t("noCashiers")}</span>
            ) : (
              cashierOptions.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={cashier.includes(c.id)}
                    onCheckedChange={() => toggle(cashier, setCashier, c.id)}
                  />
                  {c.name}
                </label>
              ))
            )}
          </FilterSection>

          <FilterSection label={t("effectiveness")}>
            {EFFECTIVENESS_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={effectiveness.includes(v)}
                  onCheckedChange={() => toggle(effectiveness, setEffectiveness, v)}
                />
                {t(`eff.${v}`)}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("redemptionCurrency")}>
            {REDEMPTION_CURRENCY_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={currency.includes(v)} onCheckedChange={() => toggle(currency, setCurrency, v)} />
                {t(`cur.${v}`)}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("entryMode")}>
            {ENTRY_SOURCE_VALUES.map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={entry.includes(v)} onCheckedChange={() => toggle(entry, setEntry, v)} />
                {t(`entry.${v}`)}
              </label>
            ))}
          </FilterSection>

          <FilterSection label={t("amountRange")}>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                inputMode="numeric"
                placeholder={t("min")}
                className="h-9"
                value={amountMin ?? ""}
                onChange={(e) => {
                  void setAmountMin(e.target.value ? Number(e.target.value) : null);
                  resetPage();
                }}
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="number"
                inputMode="numeric"
                placeholder={t("max")}
                className="h-9"
                value={amountMax ?? ""}
                onChange={(e) => {
                  void setAmountMax(e.target.value ? Number(e.target.value) : null);
                  resetPage();
                }}
              />
            </div>
          </FilterSection>

          <FilterSection label={t("col.date")}>
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
              {items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="bg-card border-border hover:border-primary/40 cursor-pointer rounded-3xl border p-4 text-left shadow-sm transition-colors"
                  onClick={() => openDetail(p.id)}
                >
                  <div className="flex items-start gap-3">
                    <span className="bg-primary/10 text-primary grid size-10 flex-none place-items-center rounded-full text-sm font-bold">
                      {(p.customerName ?? p.customerPhone).slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{p.customerName || p.customerPhone}</div>
                      <div className="text-muted-foreground truncate text-xs">
                        {p.itemSummary ?? "—"}
                      </div>
                    </div>
                    {p.storeName ? <Badge variant="outline">{p.storeName}</Badge> : null}
                  </div>
                  <div className="border-border mt-4 flex items-end justify-between border-t pt-4">
                    <div>
                      <div className="font-display text-2xl font-semibold tracking-tight">
                        {money(format, p.totalCents, p.currency)}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {formatDate(p.createdAt, { locale })}
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-emerald-600">
                      +{p.pointsEarned} {t("col.points")}
                    </span>
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
      <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">
        {label}
      </span>
      <div className="font-display mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

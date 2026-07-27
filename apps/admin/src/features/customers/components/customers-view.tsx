"use client";

import { localeFromCode } from "@loyalty/date";
import type { CustomerListItem, CustomersListInput } from "@loyalty/api/features/customers/schemas";
import { Calendar, Checkbox, Input } from "@loyalty/ui";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsIsoDate,
  parseAsString,
  useQueryState,
} from "nuqs";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import {
  DataTable,
  DataTableFilters,
  DataTablePagination,
  DataTableSortList,
  DataTableViewOptions,
  FilterSection,
  tableParsers,
} from "@/components/data-table";
import { useDataTable } from "@/components/data-table/use-data-table";
import { Link } from "@/i18n/nav";
import { money } from "@/lib/money";
import { ViewToggle } from "@/components/view-toggle";
import { useTRPC } from "@/lib/trpc/client";

import { getCustomerColumns } from "../columns";
import { customerInitials } from "../lib/initials";
import { buildCustomersInput, STATUS_VALUES, TIER_VALUES } from "../list-params";
import { CustomersBulkBar } from "./customers-bulk-bar";

export type CustomerListResult = { rows: CustomerListItem[]; total: number; pageCount: number };

/**
 * Customers list — a client `DataTable` (tanstack + react-query + nuqs) seeded
 * with the server-prefetched first page. `initialData` gives an SSR first paint
 * (no skeleton on entry) while react-query owns the cache (instant re-entry to a
 * seen filter) and `keepPreviousData` holds the current rows across filter/sort/
 * page changes. The seed is applied only when the mount input equals the current
 * input, so the queryKey matches the prefetched value exactly (see `useInitial`).
 * The rollout reference every other admin list mirrors.
 */
export function CustomersView({ initialData }: { initialData?: CustomerListResult }) {
  const t = useTranslations("Customers");
  const format = useFormatter();
  const locale = useLocale();
  const trpc = useTRPC();

  // ── URL state (facets + q). page/perPage/sort/view/cols live in useDataTable. ─
  const [q, setQ] = useQueryState("q", tableParsers.q);
  const [tier, setTier] = useQueryState("tier", parseAsArrayOf(parseAsString).withDefault([]));
  const [status, setStatus] = useQueryState("status", parseAsArrayOf(parseAsString).withDefault([]));
  const [from, setFrom] = useQueryState("from", parseAsIsoDate);
  const [to, setTo] = useQueryState("to", parseAsIsoDate);
  const [spendMin, setSpendMin] = useQueryState("spendMin", parseAsInteger);
  const [spendMax, setSpendMax] = useQueryState("spendMax", parseAsInteger);
  const [, setPage] = useQueryState("page", tableParsers.page);
  const [page] = useQueryState("page", tableParsers.page);
  const [perPage] = useQueryState("perPage", tableParsers.perPage);
  const [sort] = useQueryState("sort", tableParsers.sort);
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

  const isTierFacet = tier.length > 0 && tier.length < TIER_VALUES.length;
  const isStatusFacet = status.length > 0 && status.length < STATUS_VALUES.length;
  const activeFacets =
    (isTierFacet ? 1 : 0) +
    (isStatusFacet ? 1 : 0) +
    (from || to ? 1 : 0) +
    (spendMin != null || spendMax != null ? 1 : 0);

  const clearFilters = () => {
    void setTier(null);
    void setStatus(null);
    void setFrom(null);
    void setTo(null);
    void setSpendMin(null);
    void setSpendMax(null);
    resetPage();
  };
  const toggle = (values: string[], setter: (v: string[] | null) => void, v: string) => {
    const next = values.includes(v) ? values.filter((x) => x !== v) : [...values, v];
    void setter(next.length ? next : null);
    resetPage();
  };

  // Same builder the RSC page uses → the mount input equals the server input, so
  // the seeded `initialData` lands on the exact queryKey react-query computes.
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
  const rows = query.data?.rows ?? [];
  const pageCount = query.data?.pageCount ?? 1;
  const total = query.data?.total ?? 0;

  const columns = useMemo(() => getCustomerColumns({ t, format, locale }), [t, format, locale]);

  const { table, selectedIds, resetSelection } = useDataTable<CustomerListItem>({
    data: rows,
    columns,
    pageCount,
    getRowId: (r) => r.id,
  });

  return (
    <>
      {/* Toolbar — search + a Filters drawer; only Sort/View/toggle stay inline. */}
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
                <Checkbox
                  checked={status.includes(v)}
                  onCheckedChange={() => toggle(status, setStatus, v)}
                />
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
                <Link
                  key={c.id}
                  href={{ pathname: "/customers/[id]", params: { id: c.id } }}
                  className="bg-card border-border hover:border-primary/40 block rounded-3xl border p-4 shadow-sm transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <span className="bg-primary/10 text-primary grid size-10 flex-none place-items-center rounded-full text-sm font-bold">
                      {customerInitials(c.name, c.phone)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{c.name || c.phone}</div>
                      <div className="text-muted-foreground truncate text-xs">{c.phone}</div>
                    </div>
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
                </Link>
              ))}
            </div>
          )}
        />
        <DataTablePagination table={table} total={total} selectedCount={selectedIds.length} />
      </div>

      <CustomersBulkBar selectedIds={selectedIds} onClear={resetSelection} />
    </>
  );
}

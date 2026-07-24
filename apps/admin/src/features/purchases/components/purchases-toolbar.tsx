"use client";

import { localeFromCode } from "@loyalty/date";
import { Calendar, Checkbox, Input } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsIsoDate,
  parseAsString,
  useQueryState,
} from "nuqs";
import { useRef, useState } from "react";

import {
  DataTableFilters,
  FilterSection,
  ServerSortList,
  ServerViewOptions,
  tableParsers,
} from "@/components/data-table";
import { ViewToggle } from "@/components/view-toggle";
import { useStoreScope } from "@/lib/store-scope";
import { useTRPC } from "@/lib/trpc/client";

import { PURCHASE_COLUMNS } from "../columns";
import { EFFECTIVENESS_VALUES, ENTRY_SOURCE_VALUES, REDEMPTION_CURRENCY_VALUES } from "../list-params";
import { CustomerFilter } from "./customer-filter";

const SHALLOW = { shallow: false } as const;
const arr = () => parseAsArrayOf(parseAsString).withDefault([]).withOptions(SHALLOW);

/**
 * Client toolbar for the server purchases table. Every control writes the URL
 * with `shallow:false` → a server re-render of the table hole. The store facet
 * is hidden under a store-scoped view (the scope hard-filters instead).
 */
export function PurchasesToolbar() {
  const t = useTranslations("Purchases");
  const locale = useLocale();
  const trpc = useTRPC();
  const { storeId: scopeStoreId } = useStoreScope();

  const [q, setQ] = useQueryState("q", tableParsers.q.withOptions(SHALLOW));
  const [, setPage] = useQueryState("page", tableParsers.page.withOptions(SHALLOW));
  const [view, setView] = useQueryState("view", tableParsers.view.withOptions(SHALLOW));
  const [store, setStore] = useQueryState("store", arr());
  const [cashier, setCashier] = useQueryState("cashier", arr());
  const [effectiveness, setEffectiveness] = useQueryState("effectiveness", arr());
  const [currency, setCurrency] = useQueryState("currency", arr());
  const [entry, setEntry] = useQueryState("entry", arr());
  const [customer, setCustomer] = useQueryState("customer", arr());
  const [amountMin, setAmountMin] = useQueryState("amountMin", parseAsInteger.withOptions(SHALLOW));
  const [amountMax, setAmountMax] = useQueryState("amountMax", parseAsInteger.withOptions(SHALLOW));
  const [from, setFrom] = useQueryState("from", parseAsIsoDate.withOptions(SHALLOW));
  const [to, setTo] = useQueryState("to", parseAsIsoDate.withOptions(SHALLOW));

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

  const storesQuery = useQuery(trpc.stores.list.queryOptions({ page: 1, perPage: 100, sort: [] }));
  const employeesQuery = useQuery(
    trpc.employees.list.queryOptions({ page: 1, perPage: 100, sort: [] }),
  );
  const storeOptions = (storesQuery.data?.rows ?? []).map((s) => ({ id: s.id, name: s.name }));
  const cashierOptions = (employeesQuery.data?.rows ?? [])
    .filter((e): e is typeof e & { userId: string } => !!e.userId)
    .map((e) => ({ id: e.userId, name: e.name ?? e.email ?? e.userId }));

  const sortableCols = PURCHASE_COLUMNS.filter((c) => c.sortable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));
  const hideableCols = PURCHASE_COLUMNS.filter((c) => c.hideable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));

  const isEffFacet = effectiveness.length > 0 && effectiveness.length < EFFECTIVENESS_VALUES.length;
  const isCurFacet = currency.length > 0 && currency.length < REDEMPTION_CURRENCY_VALUES.length;
  const isEntryFacet = entry.length > 0 && entry.length < ENTRY_SOURCE_VALUES.length;
  const activeFacets =
    (!scopeStoreId && store.length > 0 ? 1 : 0) +
    (cashier.length > 0 ? 1 : 0) +
    (isEffFacet ? 1 : 0) +
    (isCurFacet ? 1 : 0) +
    (isEntryFacet ? 1 : 0) +
    (amountMin != null || amountMax != null ? 1 : 0) +
    (from || to ? 1 : 0);

  const clearFilters = () => {
    void setStore(null);
    void setCashier(null);
    void setEffectiveness(null);
    void setCurrency(null);
    void setEntry(null);
    void setAmountMin(null);
    void setAmountMax(null);
    void setFrom(null);
    void setTo(null);
    resetPage();
  };
  const toggle = (values: string[], setter: (v: string[] | null) => void, v: string) => {
    const next = values.includes(v) ? values.filter((x) => x !== v) : [...values, v];
    setter(next.length ? next : null);
    resetPage();
  };

  return (
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
        {scopeStoreId ? null : (
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
        )}
        <FilterSection label={t("col.cashier")}>
          {cashierOptions.length === 0 ? (
            <span className="text-muted-foreground text-sm">{t("noCashiers")}</span>
          ) : (
            cashierOptions.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox checked={cashier.includes(c.id)} onCheckedChange={() => toggle(cashier, setCashier, c.id)} />
                {c.name}
              </label>
            ))
          )}
        </FilterSection>
        <FilterSection label={t("effectiveness")}>
          {EFFECTIVENESS_VALUES.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox checked={effectiveness.includes(v)} onCheckedChange={() => toggle(effectiveness, setEffectiveness, v)} />
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
        <ServerSortList columns={sortableCols} />
        <ServerViewOptions columns={hideableCols} />
        <ViewToggle value={view} onValueChange={(v) => setView(v)} ariaLabel={t("viewToggle")} />
      </div>
    </div>
  );
}

"use client";

import { localeFromCode } from "@loyalty/date";
import { Calendar, Checkbox, Input } from "@loyalty/ui";
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

import { CUSTOMER_COLUMNS } from "../columns";
import { STATUS_VALUES, TIER_VALUES } from "../list-params";

const SHALLOW = { shallow: false } as const;

/**
 * Client toolbar for the server customers table: debounced search + facet
 * filters + multi-sort + column visibility + list/grid toggle. Every control
 * writes the URL with `shallow:false`, so each change re-runs the server render
 * of the table hole. Column descriptors come from {@link CUSTOMER_COLUMNS}.
 */
export function CustomersToolbar() {
  const t = useTranslations("Customers");
  const locale = useLocale();

  const [q, setQ] = useQueryState("q", tableParsers.q.withOptions(SHALLOW));
  const [, setPage] = useQueryState("page", tableParsers.page.withOptions(SHALLOW));
  const [view, setView] = useQueryState("view", tableParsers.view.withOptions(SHALLOW));
  const [tier, setTier] = useQueryState(
    "tier",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions(SHALLOW),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions(SHALLOW),
  );
  const [from, setFrom] = useQueryState("from", parseAsIsoDate.withOptions(SHALLOW));
  const [to, setTo] = useQueryState("to", parseAsIsoDate.withOptions(SHALLOW));
  const [spendMin, setSpendMin] = useQueryState("spendMin", parseAsInteger.withOptions(SHALLOW));
  const [spendMax, setSpendMax] = useQueryState("spendMax", parseAsInteger.withOptions(SHALLOW));

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

  const sortableCols = CUSTOMER_COLUMNS.filter((c) => c.sortable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));
  const hideableCols = CUSTOMER_COLUMNS.filter((c) => c.hideable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));

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
        <ServerSortList columns={sortableCols} />
        <ServerViewOptions columns={hideableCols} />
        <ViewToggle value={view} onValueChange={(v) => setView(v)} ariaLabel={t("viewToggle")} />
      </div>
    </div>
  );
}

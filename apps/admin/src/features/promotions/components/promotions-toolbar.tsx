"use client";

import { localeFromCode } from "@loyalty/date";
import { Button, Calendar, Checkbox, Input } from "@loyalty/ui";
import { useLocale, useTranslations } from "next-intl";
import { parseAsArrayOf, parseAsIsoDate, parseAsString, useQueryState } from "nuqs";
import { useRef, useState } from "react";

import {
  DataTableFilters,
  FilterSection,
  ServerSortList,
  ServerViewOptions,
  tableParsers,
} from "@/components/data-table";
import { ViewToggle } from "@/components/view-toggle";

import { PROMO_COLUMNS } from "../columns";
import {
  PROMO_AUDIENCE_VALUES,
  PROMO_STATUS_VALUES,
  PROMO_TYPE_VALUES,
  PROMO_VIGENCY_VALUES,
} from "../list-params";

const SHALLOW = { shallow: false } as const;
const arr = () => parseAsArrayOf(parseAsString).withDefault([]).withOptions(SHALLOW);

/**
 * Client toolbar for the server promotions table: debounced search + facet
 * filters + multi-sort + column visibility + list/grid toggle. Every control
 * writes the URL with `shallow:false`, so each change re-runs the server render
 * of the table hole. Column descriptors come from {@link PROMO_COLUMNS}.
 */
export function PromotionsToolbar() {
  const t = useTranslations("Promotions");
  const locale = useLocale();

  const [q, setQ] = useQueryState("q", tableParsers.q.withOptions(SHALLOW));
  const [, setPage] = useQueryState("page", tableParsers.page.withOptions(SHALLOW));
  const [view, setView] = useQueryState("view", tableParsers.view.withOptions(SHALLOW));
  const [status, setStatus] = useQueryState("status", arr());
  const [vigency, setVigency] = useQueryState("vigency", arr());
  const [type, setType] = useQueryState("type", arr());
  const [audience, setAudience] = useQueryState("audience", arr());
  const [startsFrom, setStartsFrom] = useQueryState("startsFrom", parseAsIsoDate.withOptions(SHALLOW));
  const [startsTo, setStartsTo] = useQueryState("startsTo", parseAsIsoDate.withOptions(SHALLOW));

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

  const sortableCols = PROMO_COLUMNS.filter((c) => c.sortable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));
  const hideableCols = PROMO_COLUMNS.filter((c) => c.hideable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));

  const narrows = (values: string[], all: readonly string[]) =>
    values.length > 0 && values.length < all.length ? 1 : 0;
  const activeFacets =
    narrows(status, PROMO_STATUS_VALUES) +
    narrows(vigency, PROMO_VIGENCY_VALUES) +
    narrows(type, PROMO_TYPE_VALUES) +
    narrows(audience, PROMO_AUDIENCE_VALUES) +
    (startsFrom || startsTo ? 1 : 0);

  const clearFilters = () => {
    void setStatus(null);
    void setVigency(null);
    void setType(null);
    void setAudience(null);
    void setStartsFrom(null);
    void setStartsTo(null);
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
        <FilterSection label={t("list.colStatus")}>
          {PROMO_STATUS_VALUES.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox checked={status.includes(v)} onCheckedChange={() => toggle(status, setStatus, v)} />
              {t(`list.${v}`)}
            </label>
          ))}
        </FilterSection>

        <FilterSection label={t("list.colVigency")}>
          {PROMO_VIGENCY_VALUES.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox checked={vigency.includes(v)} onCheckedChange={() => toggle(vigency, setVigency, v)} />
              {t(`list.${v}`)}
            </label>
          ))}
        </FilterSection>

        <FilterSection label={t("list.colType")}>
          {PROMO_TYPE_VALUES.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox checked={type.includes(v)} onCheckedChange={() => toggle(type, setType, v)} />
              {t(`types.${v}`)}
            </label>
          ))}
        </FilterSection>

        <FilterSection label={t("fieldAudience")}>
          {PROMO_AUDIENCE_VALUES.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox checked={audience.includes(v)} onCheckedChange={() => toggle(audience, setAudience, v)} />
              {t(`audience.${v}`)}
            </label>
          ))}
        </FilterSection>

        <FilterSection label={t("start")}>
          <div className="border-border flex justify-center rounded-2xl border p-1.5">
            <Calendar
              mode="range"
              className="[--cell-size:--spacing(9)]"
              locale={localeFromCode(locale)}
              selected={{ from: startsFrom ?? undefined, to: startsTo ?? undefined }}
              onSelect={(r: { from?: Date; to?: Date } | undefined) => {
                void setStartsFrom(r?.from ?? null);
                void setStartsTo(r?.to ?? null);
                resetPage();
              }}
            />
          </div>
          {startsFrom || startsTo ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-lg"
              onClick={() => {
                void setStartsFrom(null);
                void setStartsTo(null);
                resetPage();
              }}
            >
              {t("list.clearDate")}
            </Button>
          ) : null}
        </FilterSection>
      </DataTableFilters>
      <div className="ml-auto flex items-center gap-2">
        <ServerSortList columns={sortableCols} />
        <ServerViewOptions columns={hideableCols} />
        <ViewToggle value={view} onValueChange={(v) => setView(v)} ariaLabel={t("list.viewToggle")} />
      </div>
    </div>
  );
}

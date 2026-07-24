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

import { CAMPAIGN_COLUMNS } from "../columns";
import { STATE_VALUES, TYPE_VALUES } from "../list-params";

const SHALLOW = { shallow: false } as const;

/**
 * Client toolbar for the server campaigns table: debounced search + type facet +
 * state facet + created-date range + multi-sort + column visibility + list/grid
 * toggle. Every control writes the URL with `shallow:false`, so each change
 * re-runs the server render of the table hole. Column descriptors come from
 * {@link CAMPAIGN_COLUMNS}.
 */
export function CampaignsToolbar() {
  const t = useTranslations("Campaigns");
  const locale = useLocale();

  const [q, setQ] = useQueryState("q", tableParsers.q.withOptions(SHALLOW));
  const [, setPage] = useQueryState("page", tableParsers.page.withOptions(SHALLOW));
  const [view, setView] = useQueryState("view", tableParsers.view.withOptions(SHALLOW));
  const [type, setType] = useQueryState(
    "type",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions(SHALLOW),
  );
  const [state, setState] = useQueryState(
    "state",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions(SHALLOW),
  );
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

  const sortableCols = CAMPAIGN_COLUMNS.filter((c) => c.sortable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));
  const hideableCols = CAMPAIGN_COLUMNS.filter((c) => c.hideable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));

  const activeFacets =
    (type.length > 0 && type.length < TYPE_VALUES.length ? 1 : 0) +
    (state.length > 0 && state.length < STATE_VALUES.length ? 1 : 0) +
    (from || to ? 1 : 0);
  const clearFilters = () => {
    void setType(null);
    void setState(null);
    void setFrom(null);
    void setTo(null);
    resetPage();
  };
  const toggleType = (v: string) => {
    const next = type.includes(v) ? type.filter((x) => x !== v) : [...type, v];
    void setType(next.length ? next : null);
    resetPage();
  };
  const toggleState = (v: string) => {
    const next = state.includes(v) ? state.filter((x) => x !== v) : [...state, v];
    void setState(next.length ? next : null);
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
        <ServerSortList columns={sortableCols} />
        <ServerViewOptions columns={hideableCols} />
        <ViewToggle value={view} onValueChange={(v) => setView(v)} ariaLabel={t("viewToggle")} />
      </div>
    </div>
  );
}

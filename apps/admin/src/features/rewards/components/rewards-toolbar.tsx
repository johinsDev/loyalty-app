"use client";

import { Checkbox, Input } from "@loyalty/ui";
import { useTranslations } from "next-intl";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";
import { useRef, useState } from "react";

import {
  DataTableFilters,
  FilterSection,
  ServerSortList,
  ServerViewOptions,
  tableParsers,
} from "@/components/data-table";
import { ViewToggle } from "@/components/view-toggle";

import { REWARD_COLUMNS } from "../columns";
import { REWARD_STATUS_VALUES, REWARD_TYPE_VALUES } from "../list-params";

const SHALLOW = { shallow: false } as const;
const arr = () => parseAsArrayOf(parseAsString).withDefault([]).withOptions(SHALLOW);

/**
 * Client toolbar for the server rewards table: debounced search + status/type
 * facets + multi-sort + column visibility + list/grid toggle. Every control
 * writes the URL with `shallow:false`, so each change re-runs the server render
 * of the table hole. Column descriptors come from {@link REWARD_COLUMNS}.
 */
export function RewardsToolbar() {
  const t = useTranslations("Rewards");

  const [q, setQ] = useQueryState("q", tableParsers.q.withOptions(SHALLOW));
  const [, setPage] = useQueryState("page", tableParsers.page.withOptions(SHALLOW));
  const [view, setView] = useQueryState("view", tableParsers.view.withOptions(SHALLOW));
  const [status, setStatus] = useQueryState("status", arr());
  const [type, setType] = useQueryState("type", arr());

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

  const sortableCols = REWARD_COLUMNS.filter((c) => c.sortable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));
  const hideableCols = REWARD_COLUMNS.filter((c) => c.hideable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));

  const narrows = (values: string[], all: readonly string[]) =>
    values.length > 0 && values.length < all.length ? 1 : 0;
  const activeFacets = narrows(status, REWARD_STATUS_VALUES) + narrows(type, REWARD_TYPE_VALUES);

  const clearFilters = () => {
    void setStatus(null);
    void setType(null);
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
          {REWARD_STATUS_VALUES.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={status.includes(v)}
                onCheckedChange={() => toggle(status, setStatus, v)}
              />
              {t(`list.${v}`)}
            </label>
          ))}
        </FilterSection>
        <FilterSection label={t("list.colType")}>
          {REWARD_TYPE_VALUES.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox checked={type.includes(v)} onCheckedChange={() => toggle(type, setType, v)} />
              {t(`types.${v}`)}
            </label>
          ))}
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

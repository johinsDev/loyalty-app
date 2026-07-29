"use client";

import { Checkbox, Input } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { parseAsArrayOf, parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { useRef, useState } from "react";

import {
  DataTableFilters,
  FilterSection,
  ServerSortList,
  ServerViewOptions,
  tableParsers,
  VIEW_MODES,
} from "@/components/data-table";
import { ViewToggle } from "@/components/view-toggle";
import { useTRPC } from "@/lib/trpc/client";

import { PRODUCT_COLUMNS } from "../columns";
import { PRODUCT_STATUS_VALUES } from "../list-params";

const SHALLOW = { shallow: false } as const;
const arr = () => parseAsArrayOf(parseAsString).withOptions(SHALLOW);
const viewParser = parseAsStringLiteral(VIEW_MODES).withDefault("grid").withOptions(SHALLOW);

/**
 * Client toolbar for the server products table: debounced search + category
 * (dynamic, from `menu.categories`) and status facets + multi-sort + column
 * visibility + grid/list toggle. Every control writes the URL with
 * `shallow:false`, so each change re-runs the server render of the table hole.
 */
export function ProductsToolbar() {
  const t = useTranslations("Products");
  const tCommon = useTranslations("Common");
  const trpc = useTRPC();

  const [q, setQ] = useQueryState("q", tableParsers.q.withOptions(SHALLOW));
  const [, setPage] = useQueryState("page", tableParsers.page.withOptions(SHALLOW));
  const [view, setView] = useQueryState("view", viewParser);
  const [status, setStatus] = useQueryState(
    "status",
    parseAsArrayOf(parseAsString).withDefault(["active", "draft"]).withOptions(SHALLOW),
  );
  const [category, setCategory] = useQueryState("category", arr().withDefault([]));

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

  const categoriesQuery = useQuery(trpc.menu.categories.queryOptions());
  const categoryOptions = (categoriesQuery.data ?? []).map((c) => ({ id: c.id, label: c.name }));

  const sortableCols = PRODUCT_COLUMNS.filter((c) => c.sortable).map((c) => ({
    id: c.sortId ?? c.id,
    label: t(c.labelKey),
  }));
  const hideableCols = PRODUCT_COLUMNS.filter((c) => c.hideable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));

  const activeFacets =
    (status.length > 0 && status.length < PRODUCT_STATUS_VALUES.length ? 1 : 0) +
    (category.length > 0 ? 1 : 0);

  const clearFilters = () => {
    void setStatus(null);
    void setCategory(null);
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
        <FilterSection label={t("statusFilter")}>
          {PRODUCT_STATUS_VALUES.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={status.includes(v)}
                onCheckedChange={() => toggle(status, setStatus, v)}
              />
              {t(`status.${v}`)}
            </label>
          ))}
        </FilterSection>
        {categoryOptions.length > 0 ? (
          <FilterSection label={t("categoryFilter")}>
            {categoryOptions.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={category.includes(c.id)}
                  onCheckedChange={() => toggle(category, setCategory, c.id)}
                />
                {c.label}
              </label>
            ))}
          </FilterSection>
        ) : null}
      </DataTableFilters>
      <div className="ml-auto flex items-center gap-2">
        <ServerSortList columns={sortableCols} />
        <ServerViewOptions columns={hideableCols} />
        <ViewToggle value={view} onValueChange={(v) => setView(v)} ariaLabel={tCommon("viewToggle")} />
      </div>
    </div>
  );
}

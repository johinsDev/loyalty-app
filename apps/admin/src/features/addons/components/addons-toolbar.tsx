"use client";

import { Checkbox, Input } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
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
import { useTRPC } from "@/lib/trpc/client";

import { ADDON_COLUMNS } from "../columns";

const SHALLOW = { shallow: false } as const;
const arr = () => parseAsArrayOf(parseAsString).withDefault([]).withOptions(SHALLOW);

/**
 * Client toolbar for the server add-ons table: debounced search + category /
 * status / linked facets + multi-sort + column visibility. Every control writes
 * the URL with `shallow:false`, so each change re-runs the server render of the
 * table hole.
 */
export function AddonsToolbar() {
  const t = useTranslations("Addons");
  const trpc = useTRPC();

  const [q, setQ] = useQueryState("q", tableParsers.q.withOptions(SHALLOW));
  const [, setPage] = useQueryState("page", tableParsers.page.withOptions(SHALLOW));
  const [category, setCategory] = useQueryState("category", arr());
  const [active, setActive] = useQueryState("active", arr());
  const [linked, setLinked] = useQueryState("linked", arr());

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

  const categoriesQuery = useQuery(
    trpc.catalogCategories.list.queryOptions({ kind: "addon" }),
  );
  const categories = categoriesQuery.data ?? [];

  const sortableCols = ADDON_COLUMNS.filter((c) => c.sortable).map((c) => ({
    id: c.sortId ?? c.id,
    label: t(c.labelKey),
  }));
  const hideableCols = ADDON_COLUMNS.filter((c) => c.hideable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));

  const activeFacets =
    (category.length > 0 ? 1 : 0) + (active.length > 0 ? 1 : 0) + (linked.length > 0 ? 1 : 0);

  const clearFilters = () => {
    void setCategory(null);
    void setActive(null);
    void setLinked(null);
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
        {categories.length > 0 ? (
          <FilterSection label={t("categoryFilter")}>
            {categories.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={category.includes(c.id)}
                  onCheckedChange={() => toggle(category, setCategory, c.id)}
                />
                {c.name}
              </label>
            ))}
          </FilterSection>
        ) : null}
        <FilterSection label={t("statusFilter")}>
          {(["true", "false"] as const).map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={active.includes(v)}
                onCheckedChange={() => toggle(active, setActive, v)}
              />
              {t(v === "true" ? "status.active" : "status.inactive")}
            </label>
          ))}
        </FilterSection>
        <FilterSection label={t("linkedFilter")}>
          {(["true", "false"] as const).map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={linked.includes(v)}
                onCheckedChange={() => toggle(linked, setLinked, v)}
              />
              {t(v === "true" ? "linked.yes" : "linked.no")}
            </label>
          ))}
        </FilterSection>
      </DataTableFilters>
      <div className="ml-auto flex items-center gap-2">
        <ServerSortList columns={sortableCols} />
        <ServerViewOptions columns={hideableCols} />
      </div>
    </div>
  );
}

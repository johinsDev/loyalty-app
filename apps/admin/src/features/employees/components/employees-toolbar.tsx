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
import { ViewToggle } from "@/components/view-toggle";
import { useTRPC } from "@/lib/trpc/client";

import { EMPLOYEE_COLUMNS } from "../columns";
import { ROW_ROLES, STATUSES } from "../lib";

const SHALLOW = { shallow: false } as const;

/**
 * Client toolbar for the server employees table: debounced search + facet
 * filters (role / status / store) + multi-sort + column visibility + list/grid
 * toggle. Every control writes the URL with `shallow:false`, so each change
 * re-runs the server render of the table hole. Column descriptors come from
 * {@link EMPLOYEE_COLUMNS}.
 */
export function EmployeesToolbar() {
  const t = useTranslations("Employees");
  const trpc = useTRPC();

  const [q, setQ] = useQueryState("q", tableParsers.q.withOptions(SHALLOW));
  const [, setPage] = useQueryState("page", tableParsers.page.withOptions(SHALLOW));
  const [view, setView] = useQueryState("view", tableParsers.view.withOptions(SHALLOW));
  const [role, setRole] = useQueryState(
    "role",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions(SHALLOW),
  );
  const [status, setStatus] = useQueryState(
    "status",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions(SHALLOW),
  );
  const [storeId, setStoreId] = useQueryState(
    "storeId",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions(SHALLOW),
  );

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

  // Store options for the "Tienda" facet.
  const { data: storesData } = useQuery(
    trpc.stores.list.queryOptions({ page: 1, perPage: 100, sort: [] }),
  );
  const storeOptions = storesData?.rows ?? [];

  const sortableCols = EMPLOYEE_COLUMNS.filter((c) => c.sortable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));
  const hideableCols = EMPLOYEE_COLUMNS.filter((c) => c.hideable).map((c) => ({
    id: c.id,
    label: t(c.labelKey),
  }));

  const activeFacets =
    (role.length > 0 && role.length < ROW_ROLES.length ? 1 : 0) +
    (status.length > 0 && status.length < STATUSES.length ? 1 : 0) +
    (storeId.length > 0 ? 1 : 0);

  const clearFilters = () => {
    void setRole(null);
    void setStatus(null);
    void setStoreId(null);
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
        <FilterSection label={t("roleFilter")}>
          {ROW_ROLES.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox checked={role.includes(v)} onCheckedChange={() => toggle(role, setRole, v)} />
              {t(`role.${v}`)}
            </label>
          ))}
        </FilterSection>

        <FilterSection label={t("statusFilter")}>
          {STATUSES.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2.5 text-sm">
              <Checkbox
                checked={status.includes(v)}
                onCheckedChange={() => toggle(status, setStatus, v)}
              />
              {t(`status.${v}`)}
            </label>
          ))}
        </FilterSection>

        {storeOptions.length > 0 ? (
          <FilterSection label={t("col.stores")}>
            {storeOptions.map((s) => (
              <label key={s.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                <Checkbox
                  checked={storeId.includes(s.id)}
                  onCheckedChange={() => toggle(storeId, setStoreId, s.id)}
                />
                {s.name}
              </label>
            ))}
          </FilterSection>
        ) : null}
      </DataTableFilters>
      <div className="ml-auto flex items-center gap-2">
        <ServerSortList columns={sortableCols} />
        <ServerViewOptions columns={hideableCols} />
        <ViewToggle value={view} onValueChange={(v) => setView(v)} ariaLabel={t("viewToggle")} />
      </div>
    </div>
  );
}

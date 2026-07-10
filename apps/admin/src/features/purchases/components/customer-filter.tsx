"use client";

import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { type AsyncOption, FilterMultiSelectAsync } from "@/components/filters";
import { useTRPC } from "@/lib/trpc/client";

const label = (c: { name: string | null; phone: string }): string => c.name || c.phone;
const hint = (c: { name: string | null; phone: string }): string | undefined =>
  c.name ? c.phone : undefined;

/**
 * Customer facet for the purchases toolbar. Unlike the store / cashier facets
 * the option set is unbounded, so it searches server-side instead of filtering
 * a preloaded array. Labels learned from results are cached, and ids arriving
 * from a `?customer=` deep-link — which never show up in a search result — are
 * resolved once via `adminListByIds` so their row stays labelled.
 */
export function CustomerFilter({
  value,
  onChange,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useTranslations("Purchases");
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, { wait: 250 });

  const { data, isFetching } = useQuery(
    trpc.customers.search.queryOptions({ query: debounced, limit: 20 }),
  );

  const labels = useRef<Record<string, AsyncOption>>({});
  const options: AsyncOption[] = (data ?? []).map((c) => ({
    value: c.id,
    label: label(c),
    hint: hint(c),
  }));
  for (const o of options) labels.current[o.value] = o;

  const unresolved = useMemo(() => value.filter((id) => !labels.current[id]), [value]);
  const { data: resolved } = useQuery({
    ...trpc.customers.adminListByIds.queryOptions({ ids: unresolved }),
    enabled: unresolved.length > 0,
  });
  if (resolved) {
    for (const c of resolved) {
      labels.current[c.id] = { value: c.id, label: label(c), hint: hint(c) };
    }
  }

  const selectedOptions = value.map(
    (id) => labels.current[id] ?? { value: id, label: "…" },
  );

  return (
    <FilterMultiSelectAsync
      label={t("col.customer")}
      options={options}
      selectedOptions={selectedOptions}
      selected={value}
      onChange={onChange}
      query={query}
      onQueryChange={setQuery}
      isLoading={isFetching && options.length === 0}
      searchPlaceholder={t("searchCustomer")}
      emptyLabel={t("noCustomers")}
    />
  );
}

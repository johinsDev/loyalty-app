"use client";

import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

type Item = { id: string; name: string };

const label = (c: { name: string | null; phone: string }): string => c.name || c.phone;

/**
 * Multi-select customer facet for the purchases toolbar. Async search (server
 * side — the customer list is unbounded, so it can't filter a preloaded array
 * like the store / cashier facets) with the selection as removable chips.
 * Works in id-space; id→name labels learned from results are cached so chips
 * stay labelled across searches, and ids arriving from a `?customer=` deep-link
 * (never seen in a result) are resolved once via `adminListByIds`.
 */
export function CustomerCombobox({
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

  const { data } = useQuery(trpc.customers.search.queryOptions({ query: debounced, limit: 20 }));
  const fetched: Item[] = (data ?? []).map((c) => ({ id: c.id, name: label(c) }));

  const labels = useRef<Record<string, string>>({});
  for (const it of fetched) labels.current[it.id] = it.name;

  const unresolved = useMemo(() => value.filter((id) => !labels.current[id]), [value]);
  const { data: resolved } = useQuery({
    ...trpc.customers.adminListByIds.queryOptions({ ids: unresolved }),
    enabled: unresolved.length > 0,
  });
  if (resolved) for (const c of resolved) labels.current[c.id] = label(c);

  const selected: Item[] = value.map((id) => ({ id, name: labels.current[id] ?? "…" }));

  return (
    <Combobox
      items={fetched}
      multiple
      value={selected}
      onValueChange={(v: Item[]) => onChange(v.map((i) => i.id))}
      itemToStringLabel={(i: Item) => i.name}
      isItemEqualToValue={(a: Item, b: Item) => a.id === b.id}
      filter={null}
      inputValue={query}
      onInputValueChange={setQuery}
    >
      <ComboboxChips className="min-h-10 w-full rounded-xl sm:w-72">
        {selected.map((it) => (
          <ComboboxChip key={it.id}>{it.name}</ComboboxChip>
        ))}
        <ComboboxChipsInput placeholder={selected.length === 0 ? t("searchCustomer") : undefined} />
      </ComboboxChips>
      <ComboboxContent>
        <ComboboxEmpty>{t("noCustomers")}</ComboboxEmpty>
        <ComboboxList>
          {fetched.map((it) => (
            <ComboboxItem key={it.id} value={it}>
              {it.name}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

"use client";

import {
  Badge,
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { Fragment, useRef, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

type Item = { id: string; name: string; tierKey: string | null };

/**
 * Multi-select customer picker on the Base UI Combobox (canonical anchor + chips
 * pattern): async search via `customers.search`, selected customers shown as
 * removable chips with the input on its own full-width row (so it never shrinks).
 * Works in id-space (`value: string[]`) and caches id→label learned from results.
 */
export function CustomerCombobox({
  value,
  onChange,
  placeholder,
  emptyLabel,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const trpc = useTRPC();
  const anchor = useComboboxAnchor();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, { wait: 250 });
  const { data } = useQuery(trpc.customers.search.queryOptions({ query: debounced, limit: 10 }));

  const fetched: Item[] = (data ?? []).map((c) => ({
    id: c.id,
    name: c.nickname || c.name || c.phone,
    tierKey: c.tierKey,
  }));
  const labels = useRef<Record<string, string>>({});
  for (const it of fetched) labels.current[it.id] = it.name;

  const selected: Item[] = value.map((id) => ({
    id,
    name: labels.current[id] ?? id,
    tierKey: null,
  }));

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
      <ComboboxChips ref={anchor} className="min-h-11 w-full rounded-xl px-2 py-1.5">
        <ComboboxValue>
          {(values: Item[]) => (
            <Fragment>
              {values.map((it) => (
                <ComboboxChip key={it.id} className="h-7 px-2 text-sm">
                  {it.name}
                </ComboboxChip>
              ))}
              <ComboboxChipsInput
                className="py-1"
                placeholder={values.length === 0 ? placeholder : undefined}
              />
            </Fragment>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty className="py-3">{emptyLabel ?? "—"}</ComboboxEmpty>
        <ComboboxList className="p-2">
          {fetched.map((it) => (
            <ComboboxItem key={it.id} value={it} className="gap-3 rounded-lg py-2.5 pr-8 pl-3">
              <span className="flex-1 truncate">{it.name}</span>
              {it.tierKey ? (
                <Badge variant="outline" className="ml-auto shrink-0 text-[10px] capitalize">
                  {it.tierKey}
                </Badge>
              ) : null}
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

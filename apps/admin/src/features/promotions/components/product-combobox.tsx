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
import { useRef, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

type Item = { id: string; name: string };

/**
 * Multi-select product picker on the Base UI Combobox: async search (server-side
 * via `menu.list`, first 30) with selected items shown as removable chips. Works
 * in id-space (`value: string[]`) and caches id→name labels learned from results
 * so chips stay labelled across searches. `max` caps the selection (1 = single).
 */
export function ProductCombobox({
  value,
  onChange,
  max,
  placeholder,
  onPick,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  placeholder?: string;
  /** Fires with the picked item (id + label) whenever the selection grows. */
  onPick?: (item: { id: string; name: string }) => void;
}) {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, { wait: 250 });
  const { data } = useQuery(
    trpc.menu.list.queryOptions({ search: debounced || undefined, pageSize: 30 }),
  );

  const fetched: Item[] = (data?.items ?? []).map((p) => ({ id: p.id, name: p.name }));
  const labels = useRef<Record<string, string>>({});
  for (const it of fetched) labels.current[it.id] = it.name;

  const selected: Item[] = value.map((id) => ({ id, name: labels.current[id] ?? id }));

  return (
    <Combobox
      items={fetched}
      multiple
      value={selected}
      onValueChange={(v: Item[]) => {
        const ids = v.map((i) => i.id);
        if (onPick && ids.length > value.length) {
          const added = v[v.length - 1];
          if (added) onPick({ id: added.id, name: labels.current[added.id] ?? added.name });
        }
        onChange(max ? ids.slice(-max) : ids);
      }}
      itemToStringLabel={(i: Item) => i.name}
      isItemEqualToValue={(a: Item, b: Item) => a.id === b.id}
      filter={null}
      inputValue={query}
      onInputValueChange={setQuery}
    >
      <ComboboxChips className="min-h-10 rounded-xl">
        {selected.map((it) => (
          <ComboboxChip key={it.id}>{it.name}</ComboboxChip>
        ))}
        <ComboboxChipsInput placeholder={selected.length === 0 ? placeholder : undefined} />
      </ComboboxChips>
      <ComboboxContent>
        <ComboboxEmpty>Sin resultados</ComboboxEmpty>
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

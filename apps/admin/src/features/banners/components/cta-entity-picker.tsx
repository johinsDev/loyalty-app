"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { useRef, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

type Entity = { slug: string; name: string };

/**
 * Single-select async picker for a banner CTA target — a product or a promo,
 * searched server-side. A plain Select-style combobox (input + chevron, no
 * chips). Works in slug-space (`value: string`, the entity slug) so the wizard
 * can build the deep-link href (`/product/<slug>`, `/promos/<slug>`). Leaves the
 * input value uncontrolled so Base UI shows the selected entity's name; typing
 * drives the server search via `onInputValueChange`.
 */
export function CtaEntityPicker({
  kind,
  value,
  onChange,
  placeholder,
  emptyLabel,
}: {
  kind: "product" | "promo";
  value: string;
  onChange: (slug: string) => void;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, { wait: 250 });

  const products = useQuery({
    ...trpc.menu.list.queryOptions({ search: debounced || undefined, pageSize: 20 }),
    enabled: kind === "product",
  });
  const promos = useQuery({
    ...trpc.promociones.adminList.queryOptions({ q: debounced || undefined, page: 1, perPage: 20, sort: [] }),
    enabled: kind === "promo",
  });

  const fetched: Entity[] =
    kind === "product"
      ? (products.data?.items ?? []).map((p) => ({ slug: p.slug, name: p.name }))
      : (promos.data?.rows ?? [])
          .map((p) => ({ slug: p.slug ?? "", name: p.name ?? p.slug ?? "" }))
          .filter((p) => p.slug.length > 0);

  const labels = useRef<Record<string, string>>({});
  for (const it of fetched) labels.current[it.slug] = it.name;

  const selected: Entity | null = value
    ? { slug: value, name: labels.current[value] ?? value }
    : null;

  return (
    <Combobox
      items={fetched}
      value={selected}
      onValueChange={(v: Entity | null) => onChange(v?.slug ?? "")}
      itemToStringLabel={(i: Entity) => i.name}
      isItemEqualToValue={(a: Entity, b: Entity) => a.slug === b.slug}
      filter={null}
      onInputValueChange={setQuery}
    >
      <ComboboxInput placeholder={placeholder} className="h-10 rounded-xl" showClear={!!value} />
      <ComboboxContent>
        <ComboboxEmpty className="py-3">{emptyLabel ?? "—"}</ComboboxEmpty>
        <ComboboxList className="p-2">
          {fetched.map((it) => (
            <ComboboxItem key={it.slug} value={it} className="gap-3 rounded-lg py-2.5 pr-8 pl-3">
              <span className="flex-1 truncate">{it.name}</span>
              <span className="text-muted-foreground shrink-0 font-mono text-xs">/{it.slug}</span>
            </ComboboxItem>
          ))}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

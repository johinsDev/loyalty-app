"use client";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "ahooks";
import { ChevronDown, CupSoda, Plus, Tag, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { ProductCombobox } from "./product-combobox";

export type RefKind = "product" | "variant" | "category" | "modifierOption";
export type ItemRef = { kind: RefKind; id: string };

type SearchHit = { kind: "product" | "category"; id: string; name: string };

/**
 * Picks what a rule requirement matches, tuned for a non-technical admin: ONE
 * search box (categories + products grouped), variants as an inline refiner on
 * the product chip ("any size ▾ → Grande"), and toppings behind a secondary
 * link. Empty = any item. Labels for refs loaded from a stored rule resolve
 * through `promociones.refLabels`.
 */
export function RefsField({
  value,
  onChange,
  anyLabel,
}: {
  value: ItemRef[];
  onChange: (refs: ItemRef[]) => void;
  /** Shown when empty (e.g. "cualquier producto de la carta"). */
  anyLabel?: string;
}) {
  const t = useTranslations("Promotions.refs");
  const trpc = useTRPC();
  const labels = useRef<Record<string, string>>({});
  // Parent product of refs added this session (enables the variant refiner).
  const parentProduct = useRef<Record<string, string>>({});
  const [toppingOpen, setToppingOpen] = useState(false);
  const [toppingProductId, setToppingProductId] = useState("");

  const unresolved = useMemo(() => value.filter((r) => !labels.current[r.id]), [value]);
  const labelsQuery = useQuery({
    ...trpc.promociones.refLabels.queryOptions({ refs: unresolved }),
    enabled: unresolved.length > 0,
  });
  if (labelsQuery.data) Object.assign(labels.current, labelsQuery.data);

  const toppingOptions = useQuery({
    ...trpc.promociones.refOptions.queryOptions({ productId: toppingProductId }),
    enabled: Boolean(toppingProductId) && toppingOpen,
  });

  const has = (ref: ItemRef) => value.some((r) => r.kind === ref.kind && r.id === ref.id);
  const add = (ref: ItemRef, label?: string) => {
    if (has(ref)) return;
    if (label) labels.current[ref.id] = label;
    onChange([...value, ref]);
  };
  const remove = (ref: ItemRef) =>
    onChange(value.filter((r) => !(r.kind === ref.kind && r.id === ref.id)));
  const swap = (from: ItemRef, to: ItemRef, label: string) => {
    labels.current[to.id] = label;
    onChange(value.map((r) => (r.kind === from.kind && r.id === from.id ? to : r)));
  };

  return (
    <div className="space-y-2.5">
      {value.length === 0 ? (
        <p className="text-muted-foreground border-border/70 rounded-xl border border-dashed px-3 py-2.5 text-xs font-semibold">
          {anyLabel ?? t("any")}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {value.map((r) =>
            r.kind === "product" || r.kind === "variant" ? (
              <ProductRefChip
                key={`${r.kind}:${r.id}`}
                itemRef={r}
                label={labels.current[r.id] ?? "…"}
                productId={
                  r.kind === "product" ? r.id : (parentProduct.current[r.id] ?? null)
                }
                onSwap={(to, label) => {
                  if (to.kind === "variant" && r.kind === "product")
                    parentProduct.current[to.id] = r.id;
                  if (to.kind === "product") delete parentProduct.current[r.id];
                  swap(r, to, label);
                }}
                onRemove={() => remove(r)}
              />
            ) : (
              <span
                key={`${r.kind}:${r.id}`}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold ${
                  r.kind === "category" ? "bg-primary/10 text-primary" : "bg-muted"
                }`}
              >
                {r.kind === "category" ? (
                  <Tag className="size-3" />
                ) : (
                  <span className="text-muted-foreground font-semibold">{t("kind.modifierOption")}</span>
                )}
                {labels.current[r.id] ?? "…"}
                <button
                  type="button"
                  aria-label={t("remove")}
                  onClick={() => remove(r)}
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="size-3" />
                </button>
              </span>
            ),
          )}
        </div>
      )}

      <UnifiedSearch
        onPick={(hit) => add({ kind: hit.kind, id: hit.id }, hit.name)}
      />

      {!toppingOpen ? (
        <button
          type="button"
          onClick={() => setToppingOpen(true)}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs font-semibold"
        >
          <Plus className="size-3" />
          {t("addTopping")}
        </button>
      ) : (
        <div className="border-border/70 flex flex-wrap items-center gap-2 rounded-xl border border-dashed p-2.5">
          <span className="text-muted-foreground text-xs font-semibold">{t("toppingOf")}</span>
          <div className="min-w-48 flex-1">
            <ProductCombobox
              max={1}
              value={toppingProductId ? [toppingProductId] : []}
              onChange={(ids) => setToppingProductId(ids[0] ?? "")}
              placeholder={t("pickProduct")}
            />
          </div>
          {toppingProductId ? (
            (toppingOptions.data?.modifierOptions?.length ?? 0) > 0 ? (
              <Select
                value={null}
                onValueChange={(v) => {
                  const opt = toppingOptions.data?.modifierOptions.find((o) => o.id === v);
                  if (opt) {
                    add({ kind: "modifierOption", id: opt.id }, opt.label);
                    setToppingOpen(false);
                    setToppingProductId("");
                  }
                }}
              >
                <SelectTrigger className="h-10 w-44 text-sm">
                  <SelectValue>{() => t("pickOption")}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(toppingOptions.data?.modifierOptions ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : toppingOptions.isSuccess ? (
              <span className="text-muted-foreground text-xs">{t("noModifiers")}</span>
            ) : null
          ) : null}
          <button
            type="button"
            aria-label={t("remove")}
            onClick={() => {
              setToppingOpen(false);
              setToppingProductId("");
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

/** One search box over categories + products, grouped. Picking adds a chip. */
function UnifiedSearch({ onPick }: { onPick: (hit: SearchHit) => void }) {
  const t = useTranslations("Promotions.refs");
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, { wait: 250 });

  const products = useQuery(
    trpc.menu.list.queryOptions({ search: debounced || undefined, pageSize: 20 }),
  );
  const categories = useQuery(trpc.menu.categories.queryOptions());

  const catHits: SearchHit[] = (categories.data ?? [])
    .filter((c) => !debounced || c.name.toLowerCase().includes(debounced.toLowerCase()))
    .map((c) => ({ kind: "category", id: c.id, name: c.name }));
  const prodHits: SearchHit[] = (products.data?.items ?? []).map((p) => ({
    kind: "product",
    id: p.id,
    name: p.name,
  }));
  const items = [...catHits, ...prodHits];

  return (
    <Combobox
      items={items}
      value={null}
      onValueChange={(hit: SearchHit | null) => {
        if (hit) onPick(hit);
        setQuery("");
      }}
      itemToStringLabel={(i: SearchHit) => i.name}
      isItemEqualToValue={(a: SearchHit, b: SearchHit) => a.kind === b.kind && a.id === b.id}
      filter={null}
      inputValue={query}
      onInputValueChange={setQuery}
    >
      <ComboboxInput placeholder={t("searchPlaceholder")} className="h-10 rounded-xl" />
      <ComboboxContent>
        <ComboboxEmpty>{t("noResults")}</ComboboxEmpty>
        <ComboboxList>
          {catHits.length > 0 ? (
            <ComboboxGroup>
              <ComboboxLabel>{t("groupCategories")}</ComboboxLabel>
              {catHits.map((it) => (
                <ComboboxItem key={`c:${it.id}`} value={it}>
                  <Tag className="text-primary size-3.5" />
                  {it.name}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          ) : null}
          {prodHits.length > 0 ? (
            <ComboboxGroup>
              <ComboboxLabel>{t("groupProducts")}</ComboboxLabel>
              {prodHits.map((it) => (
                <ComboboxItem key={`p:${it.id}`} value={it}>
                  <CupSoda className="text-muted-foreground size-3.5" />
                  {it.name}
                </ComboboxItem>
              ))}
            </ComboboxGroup>
          ) : null}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/** Product chip with an inline variant refiner: "Brown Sugar Boba · any size ▾".
 *  Variant refs loaded from a stored rule (unknown parent) render as a plain chip. */
function ProductRefChip({
  itemRef,
  label,
  productId,
  onSwap,
  onRemove,
}: {
  itemRef: ItemRef;
  label: string;
  productId: string | null;
  onSwap: (to: ItemRef, label: string) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("Promotions.refs");
  const trpc = useTRPC();
  const options = useQuery({
    ...trpc.promociones.refOptions.queryOptions({ productId: productId ?? "" }),
    enabled: Boolean(productId),
  });
  const variants = options.data?.variants ?? [];
  const productName = label.split(" · ")[0] ?? label;

  return (
    <span className="bg-muted inline-flex h-9 items-center gap-1.5 rounded-full pr-3 pl-3 text-xs font-bold">
      {productName}
      {productId && variants.length > 0 ? (
        <Select
          value={itemRef.kind === "variant" ? itemRef.id : "__any__"}
          onValueChange={(v) => {
            if (!v || v === (itemRef.kind === "variant" ? itemRef.id : "__any__")) return;
            if (v === "__any__") {
              onSwap({ kind: "product", id: productId }, productName);
              return;
            }
            const variant = variants.find((x) => x.id === v);
            if (variant)
              onSwap({ kind: "variant", id: v }, `${productName} · ${variant.label}`);
          }}
        >
          <SelectTrigger className="text-primary h-6 gap-0.5 rounded-full border-none bg-transparent px-1.5 text-xs font-bold shadow-none">
            <SelectValue>
              {() =>
                itemRef.kind === "variant"
                  ? (variants.find((v) => v.id === itemRef.id)?.label ?? label.split(" · ")[1] ?? "")
                  : t("anySize")
              }
            </SelectValue>
            <ChevronDown className="size-3" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__any__">{t("anySize")}</SelectItem>
            {variants.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : itemRef.kind === "variant" && label.includes(" · ") ? (
        <span className="text-primary">{label.split(" · ")[1]}</span>
      ) : null}
      <button
        type="button"
        aria-label={t("remove")}
        onClick={onRemove}
        className="opacity-60 hover:opacity-100"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

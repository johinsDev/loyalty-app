"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { ProductCombobox } from "./product-combobox";

export type RefKind = "product" | "variant" | "category" | "modifierOption";
export type ItemRef = { kind: RefKind; id: string };

const ADD_KINDS: RefKind[] = ["product", "category", "variant", "modifierOption"];

/**
 * Picks the catalog refs a rule requirement matches (OR semantics). Empty =
 * any item. Products/categories add directly; variants and modifier options
 * are picked per product via `promociones.refOptions`. Labels for refs loaded
 * from a stored rule resolve through `promociones.refLabels`.
 */
export function RefsField({
  value,
  onChange,
  anyLabel,
}: {
  value: ItemRef[];
  onChange: (refs: ItemRef[]) => void;
  /** Shown when empty (e.g. "cualquier producto"). */
  anyLabel?: string;
}) {
  const t = useTranslations("Promotions.refs");
  const trpc = useTRPC();
  const labels = useRef<Record<string, string>>({});
  const [addKind, setAddKind] = useState<RefKind>("product");
  const [pickProductId, setPickProductId] = useState<string>("");

  const unresolved = useMemo(
    () => value.filter((r) => !labels.current[r.id]),
    [value],
  );
  const labelsQuery = useQuery({
    ...trpc.promociones.refLabels.queryOptions({ refs: unresolved }),
    enabled: unresolved.length > 0,
  });
  if (labelsQuery.data) Object.assign(labels.current, labelsQuery.data);

  const refOptions = useQuery({
    ...trpc.promociones.refOptions.queryOptions({ productId: pickProductId }),
    enabled: Boolean(pickProductId) && (addKind === "variant" || addKind === "modifierOption"),
  });

  const add = (ref: ItemRef, label?: string) => {
    if (value.some((r) => r.kind === ref.kind && r.id === ref.id)) return;
    if (label) labels.current[ref.id] = label;
    onChange([...value, ref]);
  };
  const remove = (ref: ItemRef) =>
    onChange(value.filter((r) => !(r.kind === ref.kind && r.id === ref.id)));

  return (
    <div className="space-y-2">
      <div className="border-border flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border p-2">
        {value.length === 0 ? (
          <span className="text-muted-foreground px-1 text-xs font-semibold">
            {anyLabel ?? t("any")}
          </span>
        ) : (
          value.map((r) => (
            <span
              key={`${r.kind}:${r.id}`}
              className="bg-muted inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold"
            >
              <span className="text-muted-foreground/70">{t(`kind.${r.kind}`)}</span>
              {labels.current[r.id] ?? "…"}
              <button
                type="button"
                aria-label={t("remove")}
                onClick={() => remove(r)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={addKind}
          onValueChange={(v) => {
            setAddKind((v as RefKind) ?? "product");
            setPickProductId("");
          }}
        >
          <SelectTrigger className="h-10 w-44 text-sm">
            <SelectValue>{(v) => t(`kind.${v as string}`)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {ADD_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {t(`kind.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="min-w-56 flex-1">
          {addKind === "product" ? (
            <ProductPicker onAdd={(id, name) => add({ kind: "product", id }, name)} />
          ) : addKind === "category" ? (
            <CategoryPicker onAdd={(id, name) => add({ kind: "category", id }, name)} />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <div className="min-w-48 flex-1">
                <ProductCombobox
                  max={1}
                  value={pickProductId ? [pickProductId] : []}
                  onChange={(ids) => setPickProductId(ids[0] ?? "")}
                  placeholder={t("pickProduct")}
                />
              </div>
              {pickProductId ? (
                <OptionSelect
                  options={
                    addKind === "variant"
                      ? (refOptions.data?.variants ?? [])
                      : (refOptions.data?.modifierOptions ?? [])
                  }
                  empty={t(addKind === "variant" ? "noVariants" : "noModifiers")}
                  placeholder={t("pickOption")}
                  onPick={(opt) => add({ kind: addKind, id: opt.id }, opt.label)}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** The combobox acts as an "adder": a pick promotes to a chip and clears. */
function ProductPicker({ onAdd }: { onAdd: (id: string, name: string) => void }) {
  const t = useTranslations("Promotions");
  return (
    <ProductCombobox
      value={[]}
      onChange={() => {}}
      onPick={(item) => onAdd(item.id, item.name)}
      placeholder={t("productSearch")}
    />
  );
}

function CategoryPicker({ onAdd }: { onAdd: (id: string, name: string) => void }) {
  const t = useTranslations("Promotions");
  const trpc = useTRPC();
  const { data } = useQuery(trpc.menu.categories.queryOptions());
  const cats = data ?? [];
  if (cats.length === 0)
    return <p className="text-muted-foreground text-xs">{t("noCategories")}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {cats.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onAdd(c.id, c.name)}
          className="border-border text-muted-foreground hover:border-primary/40 rounded-lg border px-3 py-1.5 text-xs font-bold"
        >
          {c.name}
        </button>
      ))}
    </div>
  );
}

function OptionSelect({
  options,
  empty,
  placeholder,
  onPick,
}: {
  options: { id: string; label: string }[];
  empty: string;
  placeholder: string;
  onPick: (opt: { id: string; label: string }) => void;
}) {
  if (options.length === 0)
    return <p className="text-muted-foreground text-xs">{empty}</p>;
  return (
    <Select
      value={null}
      onValueChange={(v) => {
        const opt = options.find((o) => o.id === v);
        if (opt) onPick(opt);
      }}
    >
      <SelectTrigger className="h-10 w-48 text-sm">
        <SelectValue>{() => placeholder}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

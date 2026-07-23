"use client";

import type { AppRouter } from "@loyalty/api";
import {
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { Check, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { CATALOG_STALE_MS } from "../catalog-cache";

type ProductDetail = NonNullable<inferRouterOutputs<AppRouter>["menu"]["productBySlug"]>;
type DetailVariant = ProductDetail["variants"][number];
type DetailModifierGroup = ProductDetail["modifierGroups"][number];

export type PickedLine = {
  productId: string;
  variantId: string | null;
  modifierOptionIds: string[];
  name: string;
  unitAmountCents: number;
  qty: number;
  note: string;
};

const formatCop = (cents: number): string =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

const deltaLabel = (cents: number): string =>
  cents === 0 ? "base" : `${cents > 0 ? "+" : ""}${formatCop(cents)}`;

/**
 * Add-a-line picker (Caja design): pick the variant (size), toggle
 * toppings/modifications from the product's modifier groups (single-select acts
 * as radio, multi as chips), add a free-form kitchen note and a quantity. The
 * unit price = variant price + selected modifier deltas; the line carries the
 * chosen variantId + modifierOptionIds so the sale records them.
 */
export function ProductPicker({
  slug,
  fallbackName,
  fallbackPriceCents,
  onAdd,
  onClose,
}: {
  slug: string;
  fallbackName: string;
  fallbackPriceCents: number;
  onAdd: (line: PickedLine) => void;
  onClose: () => void;
}) {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();
  const detail = useQuery(
    trpc.menu.productBySlug.queryOptions({ slug }, { staleTime: CATALOG_STALE_MS }),
  );
  const product = detail.data ?? null;

  const [variantId, setVariantId] = useState<string | null>(null);
  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [qty, setQty] = useState(1);

  const valueLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of product?.options ?? []) for (const v of o.values) m.set(v.id, v.label);
    return m;
  }, [product]);

  const variantLabel = (v: DetailVariant): string =>
    v.optionValueIds
      .map((id) => valueLabel.get(id))
      .filter(Boolean)
      .join(" · ");

  const variants = product?.variants ?? [];
  const selectedVariant =
    variants.find((v) => v.id === variantId) ??
    variants.find((v) => v.isDefault) ??
    variants[0] ??
    null;
  const basePrice = selectedVariant?.priceCents ?? product?.basePriceCents ?? fallbackPriceCents;

  const groups = product?.modifierGroups ?? [];
  const allOptions = groups.flatMap((g) => g.options);
  const modDelta = allOptions
    .filter((o) => selectedMods.has(o.id))
    .reduce((s, o) => s + o.priceDeltaCents, 0);
  const unit = basePrice + modDelta;

  const toggleMod = (group: DetailModifierGroup, optId: string) => {
    setSelectedMods((prev) => {
      const next = new Set(prev);
      if (next.has(optId)) {
        next.delete(optId);
      } else {
        if (group.selectionType === "single") {
          for (const o of group.options) next.delete(o.id); // radio: clear the group
        }
        next.add(optId);
      }
      return next;
    });
  };

  const add = () => {
    const vLabel = selectedVariant ? variantLabel(selectedVariant) : "";
    const modLabels = allOptions.filter((o) => selectedMods.has(o.id)).map((o) => o.name);
    const parts = [product?.name ?? fallbackName, vLabel, ...modLabels].filter(Boolean);
    onAdd({
      productId: product?.id ?? "",
      variantId: selectedVariant?.id ?? null,
      modifierOptionIds: [...selectedMods],
      name: parts.join(" · "),
      unitAmountCents: unit,
      qty,
      note: note.trim(),
    });
  };

  return (
    <ResponsiveModal open onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-lg">
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex flex-col px-6 pt-2 pb-4">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {product?.name ?? fallbackName}
            </ResponsiveModalTitle>
            {product?.description ? (
              <ResponsiveModalDescription className="bg-muted text-foreground mt-3 rounded-2xl p-3 text-sm leading-relaxed">
                <span className="text-muted-foreground/70 mb-1 block text-[0.625rem] font-extrabold tracking-wider uppercase">
                  {t("pickerContains")}
                </span>
                {product.description}
              </ResponsiveModalDescription>
            ) : null}
          </div>

          <div className="scrollbar-hide flex-1 space-y-5 overflow-y-auto px-6 pb-4">
            {/* Tamaño (variants) */}
            {variants.length > 1 ? (
              <div>
                <div className="mb-2 text-sm font-extrabold">{t("pickerSize")}</div>
                <div className="grid grid-cols-3 gap-2">
                  {variants.map((v) => {
                    const active = v.id === selectedVariant?.id;
                    const delta = v.priceCents - basePriceRef(variants, product);
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setVariantId(v.id)}
                        className={`rounded-2xl border-2 p-3 text-center ${active ? "border-primary bg-primary/5" : "border-border"}`}
                      >
                        <div className={`text-sm font-extrabold ${active ? "text-primary" : ""}`}>
                          {variantLabel(v) || t("pickerDefaultVariant")}
                        </div>
                        <div className="text-muted-foreground mt-0.5 text-xs font-bold">
                          {deltaLabel(delta)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Toppings / modifications (modifier groups) */}
            {groups.map((g) => (
              <div key={g.id}>
                <div className="mb-2 text-sm font-extrabold">{g.name}</div>
                <div className="flex flex-wrap gap-2">
                  {g.options.map((o) => {
                    const active = selectedMods.has(o.id);
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => toggleMod(g, o.id)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold ${active ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                      >
                        {active ? <Check className="size-3.5" /> : null}
                        {o.name}
                        {o.priceDeltaCents > 0 ? (
                          <span className={active ? "opacity-80" : "text-muted-foreground"}>
                            · +{formatCop(o.priceDeltaCents)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Nota */}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("pickerNotePlaceholder")}
              className="border-border bg-muted placeholder:text-muted-foreground/70 h-11 w-full rounded-2xl border px-3.5 text-sm font-semibold outline-none"
            />
          </div>

          {/* Footer: qty + add */}
          <div className="border-border flex flex-none items-center gap-3 border-t px-6 py-4">
            <div className="border-border flex items-center gap-2 rounded-xl border p-1">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="grid size-9 place-items-center rounded-lg"
                aria-label={t("decrease")}
              >
                <Minus className="size-4" />
              </button>
              <span className="w-5 text-center text-base font-extrabold">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => q + 1)}
                className="grid size-9 place-items-center rounded-lg"
                aria-label={t("increase")}
              >
                <Plus className="size-4" />
              </button>
            </div>
            <Button
              size="lg"
              disabled={detail.isPending || !product}
              onClick={add}
              className="h-12 flex-1 gap-2 rounded-2xl text-base font-extrabold"
            >
              {t("pickerAdd", { price: formatCop(unit * qty) })}
            </Button>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

/** The default variant's price — the baseline the size deltas display against. */
function basePriceRef(variants: DetailVariant[], product: ProductDetail | null): number {
  const def = variants.find((v) => v.isDefault) ?? variants[0];
  return def?.priceCents ?? product?.basePriceCents ?? 0;
}

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
import { useCashierMoney } from "../format";

import { CASHIER, LABEL } from "./chrome";

type ProductDetail = NonNullable<inferRouterOutputs<AppRouter>["menu"]["productBySlug"]>;
type DetailVariant = ProductDetail["variants"][number];
type DetailAddonGroup = ProductDetail["addonGroups"][number];

export type PickedLine = {
  productId: string;
  variantId: string | null;
  addonIds: string[];
  removedIngredientIds: string[];
  /** Everything in one string: "Classic Milk Tea · Mediano · Shot de espresso ·
   *  sin Maní". What a receipt line says; the cart shows the parts instead. */
  name: string;
  unitAmountCents: number;
  qty: number;
  note: string;
  /** The drink alone — "Classic Milk Tea · Mediano". */
  baseName: string;
  /** Its price before add-ons, so the cart can show where the money went. */
  basePriceCents: number;
  /** Priced add-ons, kept apart from the name: a cashier reading a $17.500 line
   *  can't tell how much of it is the Perlas unless the line says so. */
  addons: { id: string; name: string; priceDeltaCents: number }[];
  /** "sin Maní" — no price, but part of what the customer ordered. */
  removedLabels: string[];
};


/** The product's rich-text description arrives as HTML; the cashier box shows it
 *  as plain text (the customer app is the surface that renders the markup). */
const plainText = (html: string): string =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Add-a-line picker (Caja design): pick the variant (size), add catalog add-ons
 * (single-select acts as radio, multi as chips), toggle "sin X" for removable
 * recipe ingredients, add a free note + quantity. The unit price = variant price
 * + selected add-on deltas; the line carries the chosen variantId + addonIds +
 * removedIngredientIds so the sale records them.
 */
export function ProductPicker({
  slug,
  fallbackName,
  fallbackPriceCents,
  onAdd,
  onClose,
  initial = null,
}: {
  slug: string;
  fallbackName: string;
  fallbackPriceCents: number;
  onAdd: (line: PickedLine) => void;
  onClose: () => void;
  /** Pre-fills the picker to edit an existing cart line. Editing exists so the
   *  cashier can change a size or an add-on without deleting the line: removing
   *  it can drop the applied reward or promo, which then has to be re-picked. */
  initial?: {
    variantId: string | null;
    addonIds: string[];
    removedIngredientIds: string[];
    note: string;
    qty: number;
  } | null;
}) {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();
  const formatCop = useCashierMoney();
  const deltaLabel = (cents: number): string =>
    cents === 0 ? "base" : `${cents > 0 ? "+" : ""}${formatCop(cents)}`;
  const detail = useQuery(
    trpc.menu.productBySlug.queryOptions({ slug }, { staleTime: CATALOG_STALE_MS }),
  );
  const product = detail.data ?? null;

  const [variantId, setVariantId] = useState<string | null>(initial?.variantId ?? null);
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(
    () => new Set(initial?.addonIds ?? []),
  );
  const [removed, setRemoved] = useState<Set<string>>(
    () => new Set(initial?.removedIngredientIds ?? []),
  );
  const [note, setNote] = useState(initial?.note ?? "");
  const [qty, setQty] = useState(initial?.qty ?? 1);

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
  // A per-variant promo price is the effective charge when set.
  const effective = (v: DetailVariant): number => v.promoPriceCents ?? v.priceCents;
  const basePrice = selectedVariant ? effective(selectedVariant) : fallbackPriceCents;

  const groups = product?.addonGroups ?? [];
  const removable = product?.removableIngredients ?? [];
  const allItems = groups.flatMap((g) => g.items);
  const addonDelta = allItems
    .filter((it) => selectedAddons.has(it.addonId))
    .reduce((s, it) => s + it.priceDeltaCents, 0);
  const unit = basePrice + addonDelta;

  /** How many of a group's add-ons are currently picked. */
  const pickedIn = (group: DetailAddonGroup, set: Set<string>) =>
    group.items.filter((it) => set.has(it.addonId)).length;

  const toggleAddon = (group: DetailAddonGroup, addonId: string) => {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(addonId)) {
        next.delete(addonId);
      } else {
        if (group.selectionType === "single") {
          for (const it of group.items) next.delete(it.addonId); // radio: clear the group
        } else if (group.maxSelect != null && pickedIn(group, next) >= group.maxSelect) {
          // "Elegí hasta N" is now expressible, so the register has to enforce
          // it — `maxSelect` used to always be null and was safe to ignore.
          return prev;
        }
        next.add(addonId);
      }
      return next;
    });
  };

  const toggleRemoved = (ingredientId: string) =>
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });

  const add = () => {
    const vLabel = selectedVariant ? variantLabel(selectedVariant) : "";
    const pickedAddons = allItems
      .filter((it) => selectedAddons.has(it.addonId))
      .map((it) => ({ id: it.addonId, name: it.name, priceDeltaCents: it.priceDeltaCents }));
    const removedLabels = removable
      .filter((r) => removed.has(r.ingredientId))
      .map((r) => t("pickerWithout", { name: r.name }));
    const baseName = [product?.name ?? fallbackName, vLabel].filter(Boolean).join(" · ");
    const parts = [baseName, ...pickedAddons.map((a) => a.name), ...removedLabels].filter(Boolean);
    onAdd({
      productId: product?.id ?? "",
      variantId: selectedVariant?.id ?? null,
      addonIds: [...selectedAddons],
      removedIngredientIds: [...removed],
      name: parts.join(" · "),
      unitAmountCents: unit,
      qty,
      note: note.trim(),
      baseName,
      basePriceCents: basePrice,
      addons: pickedAddons,
      removedLabels,
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
                <span className={`${LABEL} mb-1 block`}>
                  {t("pickerContains")}
                </span>
                {plainText(product.description)}
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
                    const delta = effective(v) - basePriceRef(variants);
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
                        {/* Real price + struck regular when the variant is on promo. */}
                        <div className="mt-0.5 text-sm font-bold">
                          {formatCop(effective(v))}
                          {v.promoPriceCents != null && v.promoPriceCents < v.priceCents ? (
                            <span className="text-muted-foreground/50 ml-1 text-xs font-semibold line-through">
                              {formatCop(v.priceCents)}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-muted-foreground/70 text-[0.6875rem] font-bold">
                          {deltaLabel(delta)}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Add-on groups */}
            {groups.map((g) => (
              <div key={g.id}>
                <div className="mb-2 text-sm font-extrabold">{g.name || t("pickerAddons")}</div>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((it) => {
                    const active = selectedAddons.has(it.addonId);
                    return (
                      <button
                        key={it.addonId}
                        type="button"
                        onClick={() => toggleAddon(g, it.addonId)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold ${active ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                      >
                        {active ? <Check className="size-3.5" /> : null}
                        {it.name}
                        {it.priceDeltaCents > 0 ? (
                          <span className={active ? "opacity-80" : "text-muted-foreground"}>
                            · +{formatCop(it.priceDeltaCents)}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Sin X (removable recipe ingredients) */}
            {removable.length > 0 ? (
              <div>
                <div className="mb-2 text-sm font-extrabold">{t("pickerRemove")}</div>
                <div className="flex flex-wrap gap-2">
                  {removable.map((r) => {
                    const active = removed.has(r.ingredientId);
                    return (
                      <button
                        key={r.ingredientId}
                        type="button"
                        onClick={() => toggleRemoved(r.ingredientId)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-bold ${active ? "border-amber-500 bg-amber-500/10 text-amber-600" : "border-border text-muted-foreground"}`}
                      >
                        {active ? <Check className="size-3.5" /> : null}
                        {t("pickerWithout", { name: r.name })}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Nota */}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("pickerNotePlaceholder")}
              className={`border-border bg-muted placeholder:text-muted-foreground/70 ${CASHIER.control} w-full rounded-2xl border px-3.5 text-sm font-semibold outline-none`}
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
              className={`${CASHIER.action} flex-1 gap-2 rounded-2xl text-base font-extrabold`}
            >
              {t("pickerAdd", { price: formatCop(unit * qty) })}
            </Button>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

/** The default variant's effective price — the baseline size deltas show against. */
function basePriceRef(variants: DetailVariant[]): number {
  const def = variants.find((v) => v.isDefault) ?? variants[0];
  return def ? (def.promoPriceCents ?? def.priceCents) : 0;
}

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
import { Check, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { CATALOG_STALE_MS } from "../catalog-cache";

type ProductDetail = NonNullable<inferRouterOutputs<AppRouter>["menu"]["productBySlug"]>;
type DetailVariant = ProductDetail["variants"][number];

export type PickedLine = {
  productId: string;
  variantId: string | null;
  name: string;
  unitAmountCents: number;
  note: string;
};

const formatCop = (cents: number): string =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

/**
 * Add-a-line picker: fetches the product's variants and lets the cashier pick
 * one (size/option combo) plus a free-form note ("más hielo", "sin maní" —
 * covering subtractive modifiers until structured toggles land). A one-variant
 * product just confirms. Structured modifier groups are intentionally deferred.
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
  const [note, setNote] = useState("");

  // Map an option-value id → its label so a variant reads "Grande · Con leche".
  const valueLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of product?.options ?? []) {
      for (const v of o.values) m.set(v.id, v.label);
    }
    return m;
  }, [product]);

  const variantLabel = (v: DetailVariant): string =>
    v.optionValueIds
      .map((id) => valueLabel.get(id))
      .filter(Boolean)
      .join(" · ");

  const variants = product?.variants ?? [];
  const selected =
    variants.find((v) => v.id === variantId) ?? variants.find((v) => v.isDefault) ?? variants[0] ?? null;
  const price = selected?.priceCents ?? product?.basePriceCents ?? fallbackPriceCents;

  const add = () => {
    const label = selected ? variantLabel(selected) : "";
    onAdd({
      productId: product?.id ?? "",
      variantId: selected?.id ?? null,
      name: label ? `${product?.name ?? fallbackName} · ${label}` : (product?.name ?? fallbackName),
      unitAmountCents: price,
      note: note.trim(),
    });
  };

  return (
    <ResponsiveModal open onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
        <div className="flex flex-col px-6 pt-2 pb-6">
          <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
            {product?.name ?? fallbackName}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-muted-foreground mt-1 text-sm">
            {t("pickerHint")}
          </ResponsiveModalDescription>

          {variants.length > 1 ? (
            <div className="mt-4 space-y-1.5">
              {variants.map((v) => {
                const active = v.id === selected?.id;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    className={
                      active
                        ? "border-primary bg-primary/5 flex w-full items-center justify-between gap-3 rounded-xl border-2 p-3 text-left"
                        : "border-border flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left"
                    }
                  >
                    <span className="truncate text-sm font-bold">
                      {variantLabel(v) || t("pickerDefaultVariant")}
                    </span>
                    <span className="flex items-center gap-2 text-sm font-bold">
                      {formatCop(v.priceCents)}
                      {active ? <Check className="text-primary size-4" /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          <label className="text-muted-foreground/70 mt-4 mb-1.5 block text-[0.6875rem] font-extrabold tracking-wider">
            {t("pickerNoteLabel")}
          </label>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("pickerNotePlaceholder")}
            className="border-border bg-muted placeholder:text-muted-foreground/70 h-10 w-full rounded-2xl border px-3.5 text-sm font-semibold outline-none"
          />

          <Button
            variant="default"
            size="lg"
            disabled={detail.isPending || !product}
            onClick={add}
            className="mt-5 h-11 w-full gap-2 rounded-2xl text-base font-extrabold"
          >
            <Plus className="size-5" />
            {t("pickerAdd", { price: formatCop(price) })}
          </Button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

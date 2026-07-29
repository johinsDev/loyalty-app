"use client";

import type { AppRouter } from "@loyalty/api";
import {
  Button,
  Checkbox,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  CurrencyInput,
  Input,
  Label,
  NumberInput,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

type AddonRow = inferRouterOutputs<AppRouter>["addons"]["adminList"]["rows"][number];
type CatalogIngredient = inferRouterOutputs<AppRouter>["ingredients"]["picker"][number];

const fmt = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

export type AddonDraft = {
  id: string | null;
  name: string;
  description: string;
  priceDelta: number | undefined;
  cost: number | undefined;
  ingredientId: string | null;
  ingredientQty: number | undefined;
  categoryId: string | null;
  sku: string;
  active: boolean;
};

export const emptyAddonDraft = (): AddonDraft => ({
  id: null,
  name: "",
  description: "",
  priceDelta: undefined,
  cost: undefined,
  ingredientId: null,
  ingredientQty: undefined,
  categoryId: null,
  sku: "",
  active: true,
});

export const addonToDraft = (a: AddonRow): AddonDraft => ({
  id: a.id,
  name: a.name,
  description: a.description ?? "",
  // CurrencyInput works in major units; the API speaks cents.
  priceDelta: a.priceDeltaCents / 100,
  cost: a.costIsDerived ? undefined : a.costCents / 100,
  ingredientId: a.ingredientId,
  ingredientQty: a.ingredientQty ?? undefined,
  categoryId: a.categoryId,
  sku: a.sku ?? "",
  active: a.active,
});

/**
 * Create/edit an add-on. The cost field is only editable for a standalone
 * add-on: once it links to an ingredient the cost is derived from
 * `quantity × cost per unit`, which is shown live so the number isn't a
 * mystery, and the unit comes from the ingredient rather than being typed.
 */
export function AddonEditorDialog({
  draft,
  onClose,
}: {
  draft: AddonDraft | null;
  onClose: () => void;
}) {
  const t = useTranslations("Addons");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [value, setValue] = useState<AddonDraft | null>(draft);

  // Re-seed when a different row is opened.
  const [seed, setSeed] = useState(draft);
  if (seed !== draft) {
    setSeed(draft);
    setValue(draft);
  }

  const ingredientsQuery = useQuery(trpc.ingredients.picker.queryOptions());
  const categoriesQuery = useQuery(
    trpc.catalogCategories.list.queryOptions({ kind: "addon" }),
  );
  const ingredients = ingredientsQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  const create = useMutation(trpc.addons.create.mutationOptions());
  const update = useMutation(trpc.addons.update.mutationOptions());
  const saving = create.isPending || update.isPending;

  if (!value) return null;

  const linked = ingredients.find((i) => i.id === value.ingredientId) ?? null;
  const derivedCost =
    linked && value.ingredientQty != null
      ? Math.round(value.ingredientQty * linked.costPerUnitCents)
      : null;

  const onSave = async () => {
    const name = value.name.trim();
    if (!name) return;
    const payload = {
      name,
      description: value.description.trim() || null,
      priceDeltaCents: Math.round((value.priceDelta ?? 0) * 100),
      costCents: Math.round((value.cost ?? 0) * 100),
      ingredientId: value.ingredientId,
      ingredientQty: value.ingredientId ? (value.ingredientQty ?? 0) : null,
      categoryId: value.categoryId,
      sku: value.sku.trim() || null,
      active: value.active,
      sortOrder: 0,
    };
    try {
      if (value.id) await update.mutateAsync({ ...payload, id: value.id });
      else await create.mutateAsync(payload);
      await queryClient.invalidateQueries();
      router.refresh();
      toast.success(t(value.id ? "saved" : "created", { name }));
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    }
  };

  return (
    <ResponsiveModal open onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
        <div className="flex max-h-[85vh] flex-col overflow-y-auto px-6 pt-2 pb-6">
          <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
            {value.id ? t("addon.edit") : t("addon.new")}
          </ResponsiveModalTitle>

          <div className="mt-4 space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("addon.name")}</Label>
              <Input
                value={value.name}
                onChange={(e) => setValue({ ...value, name: e.target.value })}
                placeholder={t("addon.namePlaceholder")}
                className="h-10"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("addon.description")}</Label>
              <Input
                value={value.description}
                onChange={(e) => setValue({ ...value, description: e.target.value })}
                placeholder={t("addon.descriptionPlaceholder")}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("addon.category")}</Label>
              <Select
                value={value.categoryId ?? "none"}
                onValueChange={(v) =>
                  setValue({ ...value, categoryId: v === "none" ? null : (v ?? null) })
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue>
                    {(v) =>
                      categories.find((c) => c.id === v)?.name ?? t("addon.categoryNone")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("addon.categoryNone")}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("addon.price")}</Label>
              <CurrencyInput
                currency="COP"
                locale="es-CO"
                decimalScale={0}
                value={value.priceDelta}
                onValueChange={(v) => setValue({ ...value, priceDelta: v })}
                className="h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("addon.ingredient")}</Label>
              <Combobox<CatalogIngredient>
                items={ingredients}
                value={linked}
                onValueChange={(sel) =>
                  setValue({
                    ...value,
                    ingredientId: sel?.id ?? null,
                    ingredientQty: sel ? (value.ingredientQty ?? 0) : undefined,
                  })
                }
                itemToStringLabel={(i) => i.name}
              >
                <ComboboxInput placeholder={t("addon.ingredientNone")} className="h-10" />
                <ComboboxContent>
                  <ComboboxEmpty className="py-3">{t("addon.noneFound")}</ComboboxEmpty>
                  <ComboboxList className="p-1.5">
                    {ingredients.map((i) => (
                      <ComboboxItem key={i.id} value={i} className="rounded-lg">
                        {i.name}
                        <span className="text-muted-foreground ml-1.5 text-xs">({i.unit})</span>
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              <p className="text-muted-foreground/70 text-xs font-semibold">
                {t("addon.ingredientHint")}
              </p>
            </div>

            {linked ? (
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {t("addon.qty", { unit: linked.unit })}
                </Label>
                <NumberInput
                  value={value.ingredientQty}
                  onValueChange={(v) => setValue({ ...value, ingredientQty: v ?? 0 })}
                  min={0}
                  className="h-10"
                  suffix={` ${linked.unit}`}
                />
                <p className="text-muted-foreground text-xs font-semibold">
                  {t("addon.derivedCost", {
                    cost: fmt(derivedCost ?? 0),
                    qty: value.ingredientQty ?? 0,
                    unit: linked.unit,
                    unitCost: fmt(linked.costPerUnitCents),
                  })}
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs">{t("addon.cost")}</Label>
                <CurrencyInput
                  currency="COP"
                  locale="es-CO"
                  decimalScale={0}
                  value={value.cost}
                  onValueChange={(v) => setValue({ ...value, cost: v })}
                  className="h-10"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">{t("addon.sku")}</Label>
              <Input
                value={value.sku}
                onChange={(e) => setValue({ ...value, sku: e.target.value })}
                className="h-10"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold">
              <Checkbox
                checked={value.active}
                onCheckedChange={(c) => setValue({ ...value, active: c === true })}
              />
              {t("addon.active")}
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose} disabled={saving}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void onSave()} disabled={saving || !value.name.trim()}>
              {t("save")}
            </Button>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

"use client";

import type { AppRouter } from "@loyalty/api";
import {
  Button,
  CurrencyInput,
  Input,
  Label,
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

type IngredientRow = inferRouterOutputs<AppRouter>["ingredients"]["adminList"]["rows"][number];

/** Canonical units — mirrors `ingredientUnits` in the API, which is now the
 *  enum the endpoint validates against (it used to accept any string). */
const UNITS = ["u", "g", "kg", "ml", "l", "oz", "cda", "cdta"] as const;

export type IngredientDraft = {
  id: string | null;
  name: string;
  unit: (typeof UNITS)[number];
  costPerUnit: number | undefined;
  categoryId: string | null;
};

export const emptyIngredientDraft = (): IngredientDraft => ({
  id: null,
  name: "",
  unit: "g",
  costPerUnit: undefined,
  categoryId: null,
});

export const ingredientToDraft = (i: IngredientRow): IngredientDraft => ({
  id: i.id,
  name: i.name,
  unit: (UNITS as readonly string[]).includes(i.unit)
    ? (i.unit as (typeof UNITS)[number])
    : "u",
  costPerUnit: i.costPerUnitCents / 100,
  categoryId: i.categoryId,
});

/** Create/edit an ingredient. Until now there was no editing UI at all — an
 *  ingredient created with the wrong unit or a stale cost could never be
 *  corrected, even though the endpoint existed. */
export function IngredientEditorDialog({
  draft,
  onClose,
}: {
  draft: IngredientDraft | null;
  onClose: () => void;
}) {
  const t = useTranslations("Ingredients");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [value, setValue] = useState<IngredientDraft | null>(draft);

  const [seed, setSeed] = useState(draft);
  if (seed !== draft) {
    setSeed(draft);
    setValue(draft);
  }

  const categoriesQuery = useQuery(
    trpc.catalogCategories.list.queryOptions({ kind: "ingredient" }),
  );
  const categories = categoriesQuery.data ?? [];

  const create = useMutation(trpc.ingredients.create.mutationOptions());
  const update = useMutation(trpc.ingredients.update.mutationOptions());
  const saving = create.isPending || update.isPending;

  if (!value) return null;

  const onSave = async () => {
    const name = value.name.trim();
    if (!name) return;
    const payload = {
      name,
      unit: value.unit,
      costPerUnitCents: Math.round((value.costPerUnit ?? 0) * 100),
      categoryId: value.categoryId,
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
            {value.id ? t("ingredient.edit") : t("ingredient.new")}
          </ResponsiveModalTitle>

          <div className="mt-4 space-y-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("ingredient.name")}</Label>
              <Input
                value={value.name}
                onChange={(e) => setValue({ ...value, name: e.target.value })}
                placeholder={t("ingredient.namePlaceholder")}
                className="h-10"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">{t("ingredient.category")}</Label>
              <Select
                value={value.categoryId ?? "none"}
                onValueChange={(v) =>
                  setValue({ ...value, categoryId: v === "none" ? null : (v ?? null) })
                }
              >
                <SelectTrigger className="h-10">
                  <SelectValue>
                    {(v) =>
                      categories.find((c) => c.id === v)?.name ?? t("ingredient.categoryNone")
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("ingredient.categoryNone")}</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{t("ingredient.unit")}</Label>
                <Select
                  value={value.unit}
                  onValueChange={(v) =>
                    setValue({ ...value, unit: (v as (typeof UNITS)[number]) ?? "u" })
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNITS.map((u) => (
                      <SelectItem key={u} value={u}>
                        {u}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{t("ingredient.cost", { unit: value.unit })}</Label>
                <CurrencyInput
                  currency="COP"
                  locale="es-CO"
                  decimalScale={0}
                  value={value.costPerUnit}
                  onValueChange={(v) => setValue({ ...value, costPerUnit: v })}
                  className="h-10"
                />
              </div>
            </div>
            <p className="text-muted-foreground/70 text-xs font-semibold">
              {t("ingredient.costHint")}
            </p>
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

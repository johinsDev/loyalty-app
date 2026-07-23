"use client";

import {
  Button,
  Checkbox,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Label,
  NumberInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

import type { RecipeLine, Variant } from "../data";

const fmtCop = (cents: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    Math.round(cents) / 100,
  );

/** Common measurement units for the ingredient catalog. */
const UNITS = ["u", "g", "kg", "ml", "l", "oz", "cda", "cdta"] as const;

type CatalogItem = { id: string; name: string; unit: string; costPerUnitCents: number };

/** Per-variant recipe editor: assign catalog ingredients + quantities, mark the
 *  ones the customer sees, and show the variant's COGS + margin live. */
export function RecipeEditor({
  variants,
  onChange,
}: {
  variants: Variant[];
  onChange: (next: Variant[]) => void;
}) {
  const t = useTranslations("Products");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const catalog = useQuery(trpc.menu.ingredients.queryOptions({}));
  const createIngredient = useMutation(trpc.menu.ingredientCreate.mutationOptions());
  const ingredients = catalog.data ?? [];
  const byId = new Map(ingredients.map((i) => [i.id, i]));

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("g");
  const [cost, setCost] = useState<number | undefined>(undefined);

  const setVariant = (idx: number, next: Variant) =>
    onChange(variants.map((v, i) => (i === idx ? next : v)));
  const setLines = (idx: number, lines: RecipeLine[]) =>
    setVariant(idx, { ...variants[idx]!, ingredients: lines });

  // Recipes across variants often barely differ — copy one variant's recipe to
  // the others (or all) and tweak the exceptions, instead of retyping each.
  const cloneLines = (lines: RecipeLine[]): RecipeLine[] => lines.map((l) => ({ ...l }));
  const applyToAll = (srcIdx: number) =>
    onChange(
      variants.map((v, i) =>
        i === srcIdx ? v : { ...v, ingredients: cloneLines(variants[srcIdx]!.ingredients) },
      ),
    );
  const copyFrom = (destIdx: number, srcIdx: number) =>
    setLines(destIdx, cloneLines(variants[srcIdx]!.ingredients));

  const addLine = (idx: number) => {
    const first = ingredients[0];
    if (!first) {
      setCreating(true);
      return;
    }
    setLines(idx, [
      ...variants[idx]!.ingredients,
      { ingredientId: first.id, quantity: 0, visibleToCustomer: false, removable: false, sortOrder: variants[idx]!.ingredients.length },
    ]);
  };

  const variantCost = (v: Variant) =>
    v.ingredients.reduce(
      (s, l) => s + l.quantity * (byId.get(l.ingredientId)?.costPerUnitCents ?? 0),
      0,
    );

  const onCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createIngredient.mutateAsync({ name: trimmed, unit, costPerUnitCents: cost ?? 0 });
      await queryClient.invalidateQueries({ queryKey: trpc.menu.ingredients.queryKey() });
      setName("");
      setCost(undefined);
      setCreating(false);
      toast.success(t("recipe.created", { name: trimmed }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    }
  };

  if (variants.length === 0) {
    return <p className="text-muted-foreground text-sm font-semibold">{t("recipe.noVariants")}</p>;
  }

  return (
    <div className="space-y-4">
      {variants.map((v, idx) => {
        const c = variantCost(v);
        const price = Math.round(v.price * 100);
        const margin = price > 0 ? Math.round(((price - c) / price) * 100) : null;
        return (
          <div key={v.id} className="border-border rounded-2xl border p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold">{v.combo.join(" / ") || t("recipe.baseVariant")}</span>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs font-semibold whitespace-nowrap">
                  {t("recipe.cost")}: {fmtCop(c)}
                  {margin != null ? ` · ${t("recipe.margin")}: ${margin}%` : ""}
                </span>
                {variants.length > 1 ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("recipe.copyActions")}
                          className="size-7 rounded-lg"
                        >
                          <Copy className="size-3.5" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem
                        onClick={() => applyToAll(idx)}
                        disabled={v.ingredients.length === 0}
                      >
                        {t("recipe.applyToAll")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>{t("recipe.copyFrom")}</DropdownMenuLabel>
                      {variants.map((other, oi) =>
                        oi === idx ? null : (
                          <DropdownMenuItem
                            key={other.id}
                            onClick={() => copyFrom(idx, oi)}
                            disabled={other.ingredients.length === 0}
                          >
                            {other.combo.join(" / ") || t("recipe.baseVariant")}
                          </DropdownMenuItem>
                        ),
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </div>
            </div>

            <div className="mt-2 space-y-1.5">
              {v.ingredients.map((line, li) => {
                const ing = byId.get(line.ingredientId);
                return (
                  // eslint-disable-next-line react/no-array-index-key -- recipe lines have no stable id in v1
                  <div key={li} className="flex items-center gap-2">
                    <Combobox<CatalogItem>
                      items={ingredients}
                      value={ing ?? null}
                      onValueChange={(sel) =>
                        setLines(
                          idx,
                          v.ingredients.map((l, i) =>
                            i === li ? { ...l, ingredientId: sel?.id ?? l.ingredientId } : l,
                          ),
                        )
                      }
                      itemToStringLabel={(i) => i.name}
                    >
                      <ComboboxInput
                        placeholder={t("recipe.pickIngredient")}
                        className="h-10 flex-1"
                      />
                      <ComboboxContent>
                        <ComboboxEmpty className="py-3">{t("recipe.noneFound")}</ComboboxEmpty>
                        <ComboboxList className="p-1.5">
                          {ingredients.map((i) => (
                            <ComboboxItem key={i.id} value={i} className="rounded-lg">
                              {i.name}
                            </ComboboxItem>
                          ))}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                    <NumberInput
                      value={line.quantity}
                      onValueChange={(val) =>
                        setLines(idx, v.ingredients.map((l, i) => (i === li ? { ...l, quantity: val ?? 0 } : l)))
                      }
                      suffix={ing ? ` ${ing.unit}` : ""}
                      className="h-10 w-28"
                    />
                    <label className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                      <Checkbox
                        checked={line.visibleToCustomer}
                        onCheckedChange={(ch) =>
                          setLines(
                            idx,
                            v.ingredients.map((l, i) =>
                              i === li
                                ? {
                                    ...l,
                                    visibleToCustomer: ch === true,
                                    // Only a visible ingredient can be "sin X".
                                    removable: ch === true ? l.removable : false,
                                  }
                                : l,
                            ),
                          )
                        }
                      />
                      {t("recipe.visible")}
                    </label>
                    {line.visibleToCustomer ? (
                      <label className="flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                        <Checkbox
                          checked={line.removable}
                          onCheckedChange={(ch) =>
                            setLines(idx, v.ingredients.map((l, i) => (i === li ? { ...l, removable: ch === true } : l)))
                          }
                        />
                        {t("recipe.removable")}
                      </label>
                    ) : null}
                    <button
                      type="button"
                      aria-label={t("delete")}
                      onClick={() => setLines(idx, v.ingredients.filter((_, i) => i !== li))}
                      className="text-muted-foreground hover:text-destructive grid size-8 place-items-center rounded-lg"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => addLine(idx)}
              className="mt-2 h-9 gap-1.5 rounded-lg"
            >
              <Plus className="size-3.5" />
              {t("recipe.addIngredient")}
            </Button>
          </div>
        );
      })}

      {/* Create a catalog ingredient inline */}
      {creating ? (
        <div className="border-border bg-muted/40 space-y-2 rounded-2xl border p-3.5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-xs">{t("recipe.name")}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10" autoFocus />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">{t("recipe.unit")}</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v ?? "u")}>
                <SelectTrigger size="lg" className="w-full text-sm">
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
            <div className="space-y-2">
              <Label className="text-xs">{t("recipe.unitCost")}</Label>
              <NumberInput value={cost} onValueChange={setCost} className="h-10" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void onCreate()} disabled={!name.trim()} className="h-9 rounded-lg">
              {t("recipe.saveIngredient")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCreating(false)} className="h-9 rounded-lg">
              {t("recipe.cancel")}
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setCreating(true)} className="h-9 gap-1.5 rounded-lg">
          <Plus className="size-3.5" />
          {t("recipe.newIngredient")}
        </Button>
      )}
    </div>
  );
}

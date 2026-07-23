"use client";

import type { AppRouter } from "@loyalty/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { ArrowLeft, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

type Addon = inferRouterOutputs<AppRouter>["menu"]["addons"][number];
type CatalogIngredient = inferRouterOutputs<AppRouter>["menu"]["ingredients"][number];

const fmtCop = (cents: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

type Editing = {
  id: string | null;
  name: string;
  description: string;
  priceDelta: number | undefined;
  cost: number | undefined;
  ingredientId: string | null;
  sku: string;
  active: boolean;
};

const emptyEditing = (): Editing => ({
  id: null,
  name: "",
  description: "",
  priceDelta: undefined,
  cost: undefined,
  ingredientId: null,
  sku: "",
  active: true,
});

/**
 * Add-on catalog manager — the reusable, sellable extras attached to products
 * via groups (a topping model that generalizes beyond food). Each add-on carries
 * a price + optional cost, and may link to a stocked ingredient. Real-data CRUD
 * wired to `menu.addons` / `menu.addonCreate|Update|Remove`.
 */
export function AddonsView() {
  const t = useTranslations("Products");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const addonsQuery = useQuery(trpc.menu.addons.queryOptions({}));
  const ingredientsQuery = useQuery(trpc.menu.ingredients.queryOptions({}));
  const addons = addonsQuery.data ?? [];
  const ingredients = ingredientsQuery.data ?? [];

  const create = useMutation(trpc.menu.addonCreate.mutationOptions());
  const update = useMutation(trpc.menu.addonUpdate.mutationOptions());
  const remove = useMutation(trpc.menu.addonRemove.mutationOptions());

  const [editing, setEditing] = useState<Editing | null>(null);
  const [deleting, setDeleting] = useState<Addon | null>(null);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: trpc.menu.addons.queryKey() });

  const openCreate = () => setEditing(emptyEditing());
  const openEdit = (a: Addon) =>
    setEditing({
      id: a.id,
      name: a.name,
      description: a.description ?? "",
      priceDelta: a.priceDeltaCents / 100,
      cost: a.costCents / 100,
      ingredientId: a.ingredientId,
      sku: a.sku ?? "",
      active: a.active,
    });

  const save = async () => {
    if (!editing) return;
    const payload = {
      name: editing.name.trim(),
      description: editing.description.trim() || null,
      priceDeltaCents: Math.round((editing.priceDelta ?? 0) * 100),
      costCents: Math.round((editing.cost ?? 0) * 100),
      ingredientId: editing.ingredientId,
      sku: editing.sku.trim() || null,
      active: editing.active,
    };
    if (!payload.name) return;
    try {
      if (editing.id) await update.mutateAsync({ id: editing.id, ...payload });
      else await create.mutateAsync(payload);
      await invalidate();
      setEditing(null);
      toast.success(t("addon.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ id: deleting.id });
      await invalidate();
      setDeleting(null);
      toast.success(t("addon.deleted"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("saveError"));
    }
  };

  const selectedIngredient = ingredients.find((i) => i.id === editing?.ingredientId) ?? null;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-6">
      <Link
        href="/products"
        className="text-muted-foreground hover:text-foreground mb-3 inline-flex items-center gap-1 text-sm font-bold"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("addon.title")}</h1>
          <p className="text-muted-foreground/80 mt-0.5 text-sm font-semibold">
            {t("addon.subtitle")}
          </p>
        </div>
        <Button className="h-10 gap-2 rounded-xl font-semibold" onClick={openCreate}>
          <Plus className="size-4" />
          {t("addon.new")}
        </Button>
      </div>

      <div className="mt-5 space-y-2">
        {addonsQuery.isPending ? (
          <p className="text-muted-foreground py-10 text-center text-sm">{t("loading")}</p>
        ) : addons.length === 0 ? (
          <div className="border-border text-muted-foreground rounded-2xl border border-dashed py-12 text-center text-sm font-semibold">
            {t("addon.empty")}
          </div>
        ) : (
          addons.map((a) => (
            <div
              key={a.id}
              className="border-border bg-card flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold">{a.name}</span>
                  {!a.active ? (
                    <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-extrabold">
                      {t("addon.inactive")}
                    </span>
                  ) : null}
                </div>
                <div className="text-muted-foreground/80 mt-0.5 flex flex-wrap items-center gap-x-2 text-xs font-semibold">
                  <span className="text-primary font-extrabold">+{fmtCop(a.priceDeltaCents)}</span>
                  {a.costCents > 0 ? <span>· {t("addon.cost")}: {fmtCop(a.costCents)}</span> : null}
                  {a.ingredientName ? (
                    <span className="inline-flex items-center gap-1">
                      · <Link2 className="size-3" />
                      {a.ingredientName}
                    </span>
                  ) : null}
                  {a.sku ? <span>· {a.sku}</span> : null}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("edit")}
                className="size-9 rounded-lg"
                onClick={() => openEdit(a)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("delete")}
                className="text-muted-foreground hover:text-destructive size-9 rounded-lg"
                onClick={() => setDeleting(a)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Create / edit dialog */}
      <ResponsiveModal open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          {editing ? (
            <div className="flex max-h-[85vh] flex-col overflow-y-auto px-6 pt-2 pb-6">
              <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
                {editing.id ? t("addon.edit") : t("addon.new")}
              </ResponsiveModalTitle>

              <div className="mt-4 space-y-3.5">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("addon.name")}</Label>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder={t("addon.namePlaceholder")}
                    className="h-10"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("addon.description")}</Label>
                  <Input
                    value={editing.description}
                    onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    placeholder={t("addon.descriptionPlaceholder")}
                    className="h-10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("addon.price")}</Label>
                    <CurrencyInput
                      currency="COP"
                      locale="es-CO"
                      decimalScale={0}
                      value={editing.priceDelta}
                      onValueChange={(v) => setEditing({ ...editing, priceDelta: v })}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("addon.cost")}</Label>
                    <CurrencyInput
                      currency="COP"
                      locale="es-CO"
                      decimalScale={0}
                      value={editing.cost}
                      onValueChange={(v) => setEditing({ ...editing, cost: v })}
                      className="h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("addon.ingredient")}</Label>
                  <Combobox<CatalogIngredient>
                    items={ingredients}
                    value={selectedIngredient}
                    onValueChange={(sel) =>
                      setEditing({ ...editing, ingredientId: sel?.id ?? null })
                    }
                    itemToStringLabel={(i) => i.name}
                  >
                    <ComboboxInput placeholder={t("addon.ingredientNone")} className="h-10" />
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
                  <p className="text-muted-foreground/70 text-xs font-semibold">
                    {t("addon.ingredientHint")}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t("addon.sku")}</Label>
                  <Input
                    value={editing.sku}
                    onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                    placeholder="SKU-001"
                    className="h-10"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <Checkbox
                    checked={editing.active}
                    onCheckedChange={(ch) => setEditing({ ...editing, active: ch === true })}
                  />
                  {t("addon.active")}
                </label>
              </div>

              <div className="mt-6 flex gap-2">
                <Button
                  onClick={() => void save()}
                  disabled={!editing.name.trim() || create.isPending || update.isPending}
                  className="h-10 flex-1 rounded-xl font-extrabold"
                >
                  {t("addon.save")}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setEditing(null)}
                  className="h-10 rounded-xl"
                >
                  {t("addon.cancel")}
                </Button>
              </div>
            </div>
          ) : null}
        </ResponsiveModalContent>
      </ResponsiveModal>

      <AlertDialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("addon.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("addon.deleteBody", { name: deleting?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("addon.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

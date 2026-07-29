"use client";

import type { AppRouter } from "@loyalty/api";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  Archive,
  ArchiveRestore,
  Link2,
  MoreHorizontal,
  Package,
  Pencil,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import {
  IngredientEditorDialog,
  type IngredientDraft,
  ingredientToDraft,
} from "./ingredient-editor-dialog";

type IngredientRow = inferRouterOutputs<AppRouter>["ingredients"]["adminList"]["rows"][number];

/**
 * Per-row ⋯ menu: edit · see where it's used · archive/restore · delete.
 *
 * Deletion is gated on the reverse lookup. Previously the FK `restrict` would
 * surface a raw `FOREIGN KEY constraint failed`; now the dialog names the
 * products that block it and offers archiving instead, which is the only way
 * to retire an ingredient that recipes already reference.
 */
export function IngredientRowActions({ ingredient }: { ingredient: IngredientRow }) {
  const t = useTranslations("Ingredients");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<IngredientDraft | null>(null);
  const [usageOpen, setUsageOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const archived = ingredient.archivedAt != null;

  const usageQuery = useQuery({
    ...trpc.ingredients.usage.queryOptions({ id: ingredient.id }),
    enabled: usageOpen || confirmDelete,
  });
  const usage = usageQuery.data;

  const setArchived = useMutation(trpc.ingredients.setArchived.mutationOptions());
  const remove = useMutation(trpc.ingredients.remove.mutationOptions());

  const refresh = async () => {
    await queryClient.invalidateQueries();
    router.refresh();
  };

  const onArchive = () =>
    setArchived.mutate(
      { id: ingredient.id, archived: !archived },
      {
        onSuccess: async () => {
          await refresh();
          toast.success(t(archived ? "restored" : "archived", { name: ingredient.name }));
        },
        onError: (err) => toast.error(err.message),
      },
    );

  const onDelete = () =>
    remove.mutate(
      { id: ingredient.id },
      {
        onSuccess: async () => {
          setConfirmDelete(false);
          await refresh();
          toast.success(t("deleted", { name: ingredient.name }));
        },
        onError: (err) => toast.error(err.message),
      },
    );

  const usageBody = (
    <div className="mt-4 space-y-3">
      {usageQuery.isLoading ? (
        <p className="text-muted-foreground text-sm font-semibold">{t("loading")}</p>
      ) : !usage || (usage.products.length === 0 && usage.addons.length === 0) ? (
        <p className="text-muted-foreground text-sm font-semibold">{t("usage.none")}</p>
      ) : (
        <>
          {usage.products.map((p) => (
            <div key={p.productId} className="border-border rounded-xl border px-3 py-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Package className="size-3.5 flex-none" />
                {p.productName}
              </div>
              <div className="text-muted-foreground/70 mt-1 space-y-0.5 text-xs font-semibold">
                {p.variants.map((v) => (
                  <div key={v.variantId} className="flex justify-between gap-3">
                    <span>{v.label}</span>
                    <span className="tabular-nums">
                      {v.quantity} {ingredient.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {usage.addons.length > 0 ? (
            <div className="border-border rounded-xl border px-3 py-2">
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Link2 className="size-3.5 flex-none" />
                {t("usage.addons")}
              </div>
              <div className="text-muted-foreground/70 mt-1 text-xs font-semibold">
                {usage.addons.map((a) => a.name).join(", ")}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8" aria-label={t("rowActions")}>
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="rounded-xl">
          <DropdownMenuItem onClick={() => setDraft(ingredientToDraft(ingredient))}>
            <Pencil className="mr-2 size-4" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setUsageOpen(true)}>
            <Package className="mr-2 size-4" />
            {t("usage.see")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onArchive}>
            {archived ? (
              <ArchiveRestore className="mr-2 size-4" />
            ) : (
              <Archive className="mr-2 size-4" />
            )}
            {t(archived ? "restore" : "archive")}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-2 size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <IngredientEditorDialog draft={draft} onClose={() => setDraft(null)} />

      {/* Where it's used */}
      <ResponsiveModal open={usageOpen} onOpenChange={(o) => !o && setUsageOpen(false)}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="flex max-h-[85vh] flex-col overflow-y-auto px-6 pt-2 pb-6">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("usage.title", { name: ingredient.name })}
            </ResponsiveModalTitle>
            {usageBody}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

      {/* Delete, gated on the reverse lookup */}
      <ResponsiveModal open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="flex max-h-[85vh] flex-col overflow-y-auto px-6 pt-2 pb-6">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("deleteTitle", { name: ingredient.name })}
            </ResponsiveModalTitle>

            {usage && !usage.canDelete ? (
              <>
                <p className="mt-2 flex items-start gap-1.5 text-sm font-semibold text-amber-600">
                  <TriangleAlert className="mt-0.5 size-4 flex-none" />
                  {t("deleteBlocked", { n: usage.products.length })}
                </p>
                {usageBody}
              </>
            ) : (
              <p className="text-muted-foreground mt-2 text-sm font-semibold">
                {usage && usage.addons.length > 0
                  ? t("deleteUnlinks", { n: usage.addons.length })
                  : t("deleteHint")}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t("cancel")}
              </Button>
              {usage && !usage.canDelete ? (
                <Button onClick={onArchive} disabled={setArchived.isPending}>
                  <Archive className="mr-2 size-4" />
                  {t("archive")}
                </Button>
              ) : (
                <Button
                  variant="destructive"
                  onClick={onDelete}
                  disabled={remove.isPending || usageQuery.isLoading}
                >
                  {t("delete")}
                </Button>
              )}
            </div>
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

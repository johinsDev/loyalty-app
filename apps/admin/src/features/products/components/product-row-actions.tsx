"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

type ProductActionsRow = { id: string; name: string };

/** Per-row ⋯ menu for the products server table: edit (→ editor) · delete
 *  (confirm → `menu.remove`). The list is an RSC, so after a mutation we
 *  invalidate any react-query consumer and `router.refresh()` to re-render it. */
export function ProductRowActions({ product }: { product: ProductActionsRow }) {
  const t = useTranslations("Products");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const remove = useMutation(trpc.menu.remove.mutationOptions());

  const onDelete = () =>
    remove.mutate(
      { id: product.id },
      {
        onSuccess: () => {
          toast.success(t("deleted", { name: product.name }));
          setConfirmDelete(false);
          void queryClient.invalidateQueries(trpc.menu.adminList.queryFilter());
          router.refresh();
        },
        onError: (err) => toast.error(err instanceof Error ? err.message : t("saveError")),
      },
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8 rounded-lg" aria-label={t("edit")} />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={() => router.push({ pathname: "/products/[id]", params: { id: product.id } })}
          >
            <Pencil className="size-4" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveModal open={confirmDelete} onOpenChange={setConfirmDelete}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("deleteTitle")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground px-4 pb-2 text-sm">
            {t("deleteDescription", { name: product.name })}
          </p>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setConfirmDelete(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 rounded-full px-6 font-semibold"
              onClick={onDelete}
              disabled={remove.isPending}
            >
              {t("deleteConfirm")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

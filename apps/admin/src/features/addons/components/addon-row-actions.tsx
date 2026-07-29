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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@loyalty/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import { AddonEditorDialog, type AddonDraft, addonToDraft } from "./addon-editor-dialog";

type AddonRow = inferRouterOutputs<AppRouter>["addons"]["adminList"]["rows"][number];

/** Per-row ⋯ menu for the add-ons server table: edit (dialog) · delete
 *  (confirm). The list is an RSC, so after a mutation we invalidate the
 *  react-query consumers and `router.refresh()` to re-render it. */
export function AddonRowActions({ addon }: { addon: AddonRow }) {
  const t = useTranslations("Addons");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draft, setDraft] = useState<AddonDraft | null>(null);

  const remove = useMutation(trpc.addons.remove.mutationOptions());

  const onDelete = () =>
    remove.mutate(
      { id: addon.id },
      {
        onSuccess: async () => {
          setConfirmDelete(false);
          await queryClient.invalidateQueries();
          router.refresh();
          toast.success(t("deleted", { name: addon.name }));
        },
        onError: (err) => toast.error(err.message),
      },
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
          <DropdownMenuItem onClick={() => setDraft(addonToDraft(addon))}>
            <Pencil className="mr-2 size-4" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="mr-2 size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AddonEditorDialog draft={draft} onClose={() => setDraft(null)} />

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle", { name: addon.name })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteHint")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} disabled={remove.isPending}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

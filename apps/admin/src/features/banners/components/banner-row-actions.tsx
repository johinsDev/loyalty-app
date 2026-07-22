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
import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

/** Per-row ⋯ menu for a banner: view detail · edit · delete. */
export function BannerRowActions({ banner }: { banner: { id: string; name: string } }) {
  const t = useTranslations("Banners");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [, setDetailId] = useQueryState("detalle", parseAsString);
  const [open, setOpen] = useState(false);
  const invalidate = () => queryClient.invalidateQueries(trpc.banners.adminList.queryFilter());
  const remove = useMutation(trpc.banners.remove.mutationOptions());

  const onDelete = () =>
    remove.mutate(
      { id: banner.id },
      {
        onSuccess: () => {
          toast.success(t("deleted", { name: banner.name }));
          setOpen(false);
          void invalidate();
        },
        onError: () => toast.error(t("saveError")),
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
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => void setDetailId(banner.id)}>
            <Eye className="size-4" />
            {t("viewDetail")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push({ pathname: "/banners/[id]/edit", params: { id: banner.id } })}
          >
            <Pencil className="size-4" />
            {t("edit")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setOpen(true)}>
            <Trash2 className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("deleteTitle")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground px-4 pb-2 text-sm">
            {t("deleteDescription", { name: banner.name })}
          </p>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setOpen(false)}
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

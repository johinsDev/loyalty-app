"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

/** Per-row ⋯ menu: edit · make primary · delete (type-the-exact-name). */
export function StoreRowActions({ store }: { store: { id: string; name: string; isPrimary: boolean } }) {
  const t = useTranslations("Stores");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, watch, reset } = useForm<{ confirm: string }>({
    defaultValues: { confirm: "" },
  });
  const invalidate = () => queryClient.invalidateQueries(trpc.stores.list.queryFilter());
  const remove = useMutation(trpc.stores.remove.mutationOptions());
  const setPrimary = useMutation(trpc.stores.setPrimary.mutationOptions({ onSuccess: invalidate }));
  const matches = watch("confirm").trim() === store.name.trim() && store.name.trim().length > 0;

  const onSubmit = handleSubmit(() => {
    if (!matches) return;
    remove.mutate(
      { id: store.id },
      {
        onSuccess: () => {
          toast.success(t("deleted", { name: store.name }));
          setOpen(false);
          reset();
          void invalidate();
        },
        onError: () => toast.error(t("deleteLastError")),
      },
    );
  });

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
          <DropdownMenuItem
            onClick={() => router.push({ pathname: "/stores/[id]", params: { id: store.id } })}
          >
            <Eye className="size-4" />
            {t("viewDetail")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => router.push({ pathname: "/stores/[id]/edit", params: { id: store.id } })}
          >
            <Pencil className="size-4" />
            {t("edit")}
          </DropdownMenuItem>
          {!store.isPrimary ? (
            <DropdownMenuItem onClick={() => setPrimary.mutate({ id: store.id })}>
              <Star className="size-4" />
              {t("makePrimary")}
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setOpen(true)}>
            <Trash2 className="size-4" />
            {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent>
          <form onSubmit={onSubmit}>
            <ResponsiveModalHeader>
              <ResponsiveModalTitle>{t("deleteTitle")}</ResponsiveModalTitle>
            </ResponsiveModalHeader>
            <div className="space-y-2 px-4 pb-2">
              <p className="text-muted-foreground text-sm">
                {t("deleteTypeHint", { name: store.name })}
              </p>
              <Input className="h-10" placeholder={store.name} autoFocus {...register("confirm")} />
            </div>
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
                type="submit"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-10 rounded-full px-6 font-semibold"
                disabled={!matches || remove.isPending}
              >
                {t("deleteConfirm")}
              </Button>
            </ResponsiveModalFooter>
          </form>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

"use client";

import {
  Badge,
  Button,
  Input,
  Label,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Tiendas — branches list wired to `stores.list`. Add/edit navigate to a page;
 * delete confirms; a star sets the primary store. A header control flips the
 * org's loyalty wallet scope (shared vs per-store — enforcement deferred).
 */
export function StoresView() {
  const t = useTranslations("Stores");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: stores, isLoading } = useQuery(trpc.stores.list.queryOptions());
  const invalidate = () => queryClient.invalidateQueries(trpc.stores.list.queryFilter());

  const setPrimary = useMutation(
    trpc.stores.setPrimary.mutationOptions({ onSuccess: () => invalidate() }),
  );

  const rows = stores ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button
          className="h-10 gap-1.5 rounded-xl"
          onClick={() => router.push("/stores/new")}
        >
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      <LoyaltyScopeControl />

      {isLoading ? (
        <div className="mt-6 space-y-3">
          {["a", "b"].map((k) => (
            <Skeleton key={k} className="h-20 rounded-3xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="border-border mt-6 rounded-3xl border border-dashed p-12 text-center">
          <p className="font-semibold">{t("empty")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {rows.map((s) => (
            <div
              key={s.id}
              className="bg-card border-border flex items-center gap-4 rounded-3xl border p-4 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{s.name || t("namePlaceholder")}</span>
                  {s.isPrimary ? <Badge variant="secondary">{t("primary")}</Badge> : null}
                  {s.status === "draft" ? (
                    <Badge variant="outline">{t("draft")}</Badge>
                  ) : (
                    <Badge variant={s.isPublished ? "default" : "outline"}>
                      {s.isPublished ? t("published") : t("unpublished")}
                    </Badge>
                  )}
                </div>
                {s.address ? (
                  <p className="text-muted-foreground mt-0.5 flex items-center gap-1 truncate text-xs">
                    <MapPin className="size-3" />
                    {s.address}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-1.5">
                {!s.isPrimary ? (
                  <Button
                    variant="ghost"
                    className="size-9 rounded-xl p-0"
                    aria-label={t("makePrimary")}
                    onClick={() => setPrimary.mutate({ id: s.id })}
                  >
                    <Star className="size-4" />
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  className="h-9 gap-1.5 rounded-xl"
                  onClick={() => router.push({ pathname: "/stores/[id]", params: { id: s.id } })}
                >
                  <Pencil className="size-3.5" />
                  {t("edit")}
                </Button>
                <DeleteStoreButton store={s} onDeleted={invalidate} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Destructive delete behind a type-the-exact-name confirmation (RHF). The BE
 *  soft-deletes and refuses the last store (surfaced as an error toast). */
function DeleteStoreButton({
  store,
  onDeleted,
}: {
  store: { id: string; name: string };
  onDeleted: () => void;
}) {
  const t = useTranslations("Stores");
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, watch, reset } = useForm<{ confirm: string }>({
    defaultValues: { confirm: "" },
  });
  const remove = useMutation(trpc.stores.remove.mutationOptions());
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
          onDeleted();
        },
        onError: () => toast.error(t("deleteLastError")),
      },
    );
  });

  return (
    <>
      <Button
        variant="outline"
        className="text-destructive size-9 rounded-xl p-0"
        aria-label={t("delete")}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>
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

/** Org loyalty wallet scope: shared across stores or per-store (deferred). */
function LoyaltyScopeControl() {
  const t = useTranslations("Stores");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useQuery(trpc.settings.branding.queryOptions());
  const update = useMutation(
    trpc.settings.setLoyaltyScope.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.settings.branding.queryFilter());
        toast.success(t("scopeSaved"));
      },
    }),
  );

  return (
    <div className="border-border mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
      <div>
        <Label className="text-sm font-semibold">{t("scopeTitle")}</Label>
        <p className="text-muted-foreground text-xs">{t("scopeHint")}</p>
      </div>
      <Select
        value={data?.loyaltyScope ?? "org"}
        onValueChange={(v) => update.mutate({ loyaltyScope: (v as "org" | "store") ?? "org" })}
      >
        <SelectTrigger size="lg" className="w-48 text-sm">
          <SelectValue>{(v) => t(`scope.${v as string}`)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="org">{t("scope.org")}</SelectItem>
          <SelectItem value="store">{t("scope.store")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

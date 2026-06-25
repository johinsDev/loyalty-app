"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Input,
  Skeleton,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

/** Admin promotions list — wired to `promociones.list`. Create spins up a draft
 *  and routes to the editor; rows link to edit; delete with confirm. */
export function PromotionsView() {
  const t = useTranslations("Promotions");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery(
    trpc.promociones.list.queryOptions({ search: search || undefined, page: 1, pageSize: 50 }),
  );
  const create = useMutation(trpc.promociones.create.mutationOptions());
  const remove = useMutation(
    trpc.promociones.remove.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries(trpc.promociones.list.queryFilter()),
    }),
  );

  const rows = data?.rows ?? [];

  const onNew = () =>
    create.mutate(undefined, {
      onSuccess: (promo) =>
        router.push({ pathname: "/promotions/[id]", params: { id: promo.id } }),
    });

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button className="h-10 gap-1.5 rounded-xl" onClick={onNew} disabled={create.isPending}>
          <Plus className="size-4" />
          {t("add")}
        </Button>
      </div>

      <div className="relative mt-5 max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="h-10 pl-9"
        />
      </div>

      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {["a", "b", "c"].map((k) => (
            <Skeleton key={k} className="h-40 rounded-3xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="border-border mt-6 rounded-3xl border border-dashed p-12 text-center">
          <p className="font-semibold">{t("empty")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <div
              key={p.id}
              className="bg-card border-border flex flex-col overflow-hidden rounded-3xl border shadow-sm"
            >
              <div
                className="relative h-24"
                style={{ background: p.backgroundCss ?? "var(--muted)" }}
              >
                {p.badgeLabel ? (
                  <span className="absolute top-3 left-3 inline-flex rounded-full bg-white/25 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
                    {p.badgeLabel}
                  </span>
                ) : null}
                <Badge className="absolute top-3 right-3 border-0 bg-black/40 text-white">
                  {p.status === "published" ? "●" : "○"} {p.status}
                </Badge>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-semibold">{p.name ?? "—"}</p>
                <p className="text-muted-foreground mt-0.5 text-xs">{p.type ?? "—"}</p>
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-9 flex-1 gap-1.5 rounded-xl"
                    onClick={() =>
                      router.push({ pathname: "/promotions/[id]", params: { id: p.id } })
                    }
                  >
                    <Pencil className="size-3.5" />
                    {t("edit")}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={
                        <Button
                          variant="outline"
                          className="text-destructive size-9 rounded-xl p-0"
                          aria-label={t("delete")}
                        />
                      }
                    >
                      <Trash2 className="size-4" />
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t("deleteDescription", { name: p.name ?? "—" })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            remove.mutate(
                              { id: p.id },
                              { onSuccess: () => toast.success(t("deleted", { name: p.name ?? "—" })) },
                            )
                          }
                        >
                          {t("deleteConfirm")}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

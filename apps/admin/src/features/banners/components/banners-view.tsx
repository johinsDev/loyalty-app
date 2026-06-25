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
import { Bell, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

type DisplayState = "draft" | "scheduled" | "active" | "expired";

const STATE_STYLE: Record<DisplayState, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  expired: "bg-muted text-muted-foreground",
  draft: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
};

/** Admin banners list — published + draft banners with their derived display
 *  state, scheduled-notification count, search, edit and delete. */
export function BannersView() {
  const t = useTranslations("Banners");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data, isLoading } = useQuery(
    trpc.banners.list.queryOptions({ search: search || undefined, page: 1, pageSize: 50 }),
  );

  const remove = useMutation(
    trpc.banners.remove.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.banners.list.queryFilter());
      },
    }),
  );

  const rows = data?.rows ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button className="h-10 gap-1.5 rounded-xl" onClick={() => router.push("/banners/new")}>
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
            <Skeleton key={k} className="h-44 rounded-3xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="border-border mt-6 rounded-3xl border border-dashed p-12 text-center">
          <p className="font-semibold">{t("empty")}</p>
          <p className="text-muted-foreground mt-1 text-sm">{t("emptyHint")}</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ banner, displayState, notificationCount }) => (
            <div
              key={banner.id}
              className="bg-card border-border flex flex-col overflow-hidden rounded-3xl border shadow-sm"
            >
              <div
                className="relative h-28"
                style={{ background: banner.backgroundCss ?? "var(--muted)" }}
              >
                <Badge
                  className={`absolute top-3 left-3 border-0 ${STATE_STYLE[displayState as DisplayState]}`}
                >
                  {t(`state.${displayState}`)}
                </Badge>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="font-semibold">{banner.name}</p>
                {banner.shortDescription ? (
                  <p className="text-muted-foreground mt-0.5 line-clamp-1 text-sm">
                    {banner.shortDescription}
                  </p>
                ) : null}
                <div className="text-muted-foreground mt-3 flex items-center gap-3 text-xs font-semibold">
                  {notificationCount > 0 ? (
                    <span className="inline-flex items-center gap-1">
                      <Bell className="size-3.5" />
                      {notificationCount}
                    </span>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-9 flex-1 gap-1.5 rounded-xl"
                    onClick={() =>
                      router.push({ pathname: "/banners/[id]", params: { id: banner.id } })
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
                          {t("deleteDescription", { name: banner.name })}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            remove.mutate(
                              { id: banner.id },
                              {
                                onSuccess: () =>
                                  toast.success(t("deleted", { name: banner.name })),
                              },
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

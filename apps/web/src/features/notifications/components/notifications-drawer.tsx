"use client";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  Spinner,
} from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell,
  Gift,
  type LucideIcon,
  PartyPopper,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

import { useNotificationsDrawer } from "../hooks/use-notifications-drawer";

const TYPE_ICON: Record<string, LucideIcon> = {
  "first-purchase": PartyPopper,
  welcome: PartyPopper,
  promo: Zap,
  reward: Gift,
};

/**
 * In-app notifications inbox as a bottom-sheet drawer, backed by the real feed
 * (the `database` notification channel via `notifications.listMine`). Tapping an
 * unread row marks it read (dismiss). Mounted once in the locale layout; opened
 * by the header bell and the on-entry surface through {@link useNotificationsDrawer}.
 */
export function NotificationsDrawer() {
  const t = useTranslations("Notifications");
  const format = useFormatter();
  const trpc = useTRPC();
  const open = useNotificationsDrawer((s) => s.open);
  const setOpen = useNotificationsDrawer((s) => s.setOpen);

  const list = useQuery({
    ...trpc.notifications.listMine.queryOptions({
      filter: "all",
      page: 1,
      pageSize: 50,
    }),
    enabled: open,
  });

  const markRead = useMutation(trpc.notifications.markRead.mutationOptions());
  const markAllRead = useMutation(
    trpc.notifications.markAllRead.mutationOptions(),
  );
  const remove = useMutation(trpc.notifications.delete.mutationOptions());

  const rows = list.data?.rows ?? [];
  const unread = rows.filter((r) => !r.readAt).length;
  const busy = markRead.isPending || markAllRead.isPending || remove.isPending;

  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      await list.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent aria-describedby={undefined}>
        <DrawerHeader className="flex flex-row items-center justify-between border-b py-3 text-left">
          <DrawerTitle className="text-lg">{t("title")}</DrawerTitle>
          <div className="flex items-center gap-1">
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void run(() => markAllRead.mutateAsync())}
                disabled={busy}
                className="text-primary px-2 text-xs font-semibold disabled:opacity-50"
              >
                {t("markAllRead")}
              </button>
            ) : null}
            <DrawerClose
              aria-label="Cerrar"
              className="text-muted-foreground hover:bg-muted grid size-8 place-items-center rounded-full"
            >
              <X className="size-5" />
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {list.isLoading ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-3 py-14 text-center">
              <span className="bg-muted grid size-14 place-items-center rounded-2xl">
                <Bell className="size-6" />
              </span>
              <p className="text-sm">{t("empty")}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {rows.map((row) => {
                const isUnread = !row.readAt;
                const Icon = TYPE_ICON[row.type] ?? Bell;
                return (
                  <li key={row.id}>
                    <div
                      className={`flex items-start gap-3 rounded-2xl p-3 ${
                        isUnread ? "bg-primary/5" : ""
                      }`}
                    >
                      <span className="bg-primary/10 text-primary grid size-11 flex-none place-items-center rounded-xl">
                        <Icon className="size-5" />
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          isUnread &&
                          void run(() => markRead.mutateAsync({ id: row.id }))
                        }
                        disabled={busy || !isUnread}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isUnread ? (
                            <span
                              className="bg-primary size-2 flex-none rounded-full"
                              aria-hidden
                            />
                          ) : null}
                          <span className="text-foreground truncate text-sm font-bold">
                            {row.title}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-sm">
                          {row.body}
                        </p>
                        <time className="text-muted-foreground mt-1 block text-xs">
                          {format.relativeTime(new Date(row.createdAt))}
                        </time>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void run(() => remove.mutateAsync({ id: row.id }))
                        }
                        disabled={busy}
                        aria-label={t("delete")}
                        className="text-muted-foreground hover:text-foreground grid size-8 flex-none place-items-center rounded-full"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

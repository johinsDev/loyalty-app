"use client";

import {
  Badge,
  Button,
  Card,
  CardContent,
  Spinner,
} from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCheckIcon, CheckIcon, Trash2Icon } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

/**
 * The in-app feed UI. Reads `notifications.listMine` and exposes mark-read /
 * mark-all-read / delete / delete-all. Clicking an unread row marks it read.
 * After every mutation it refetches the list so counts stay in sync.
 */
export function NotificationsList() {
  const t = useTranslations("Notifications");
  const format = useFormatter();
  const trpc = useTRPC();

  const list = useQuery(
    trpc.notifications.listMine.queryOptions({
      filter: "all",
      page: 1,
      pageSize: 50,
    }),
  );

  const markRead = useMutation(trpc.notifications.markRead.mutationOptions());
  const markAllRead = useMutation(
    trpc.notifications.markAllRead.mutationOptions(),
  );
  const remove = useMutation(trpc.notifications.delete.mutationOptions());
  const removeAll = useMutation(
    trpc.notifications.deleteAll.mutationOptions(),
  );

  const rows = list.data?.rows ?? [];
  const unread = rows.filter((r) => !r.readAt).length;
  const busy =
    markRead.isPending ||
    markAllRead.isPending ||
    remove.isPending ||
    removeAll.isPending;

  const onMarkRead = async (id: string) => {
    try {
      await markRead.mutateAsync({ id });
      await list.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    }
  };

  const onMarkAllRead = async () => {
    try {
      await markAllRead.mutateAsync();
      await list.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    }
  };

  const onDelete = async (id: string) => {
    try {
      await remove.mutateAsync({ id });
      await list.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    }
  };

  const onDeleteAll = async () => {
    try {
      const res = await removeAll.mutateAsync();
      await list.refetch();
      toast.success(t("deletedAll", { count: res.deleted }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("actionFailed"));
    }
  };

  if (list.isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {unread > 0 ? t("unreadCount", { count: unread }) : t("allRead")}
        </span>
        <div className="flex gap-2">
          {unread > 0 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onMarkAllRead}
              disabled={busy}
            >
              <CheckCheckIcon className="size-4" aria-hidden />
              {t("markAllRead")}
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={onDeleteAll}
            disabled={busy}
          >
            <Trash2Icon className="size-4" aria-hidden />
            {t("deleteAll")}
          </Button>
        </div>
      </div>

      <ul className="space-y-2">
        {rows.map((row) => {
          const isUnread = !row.readAt;
          return (
            <li key={row.id}>
              <Card
                className={isUnread ? "border-primary/40 bg-primary/5" : ""}
              >
                <CardContent className="flex items-start gap-3 p-3">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => isUnread && onMarkRead(row.id)}
                    disabled={busy || !isUnread}
                  >
                    <div className="flex items-center gap-2">
                      {isUnread ? (
                        <span
                          className="size-2 shrink-0 rounded-full bg-primary"
                          aria-hidden
                        />
                      ) : null}
                      <span className="truncate text-sm font-medium">
                        {row.title}
                      </span>
                      <Badge variant="outline" className="ml-auto shrink-0">
                        {row.category}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.body}
                    </p>
                    <time className="mt-1 block text-xs text-muted-foreground">
                      {format.relativeTime(new Date(row.createdAt))}
                    </time>
                  </button>
                  <div className="flex shrink-0 flex-col gap-1">
                    {isUnread ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t("markRead")}
                        onClick={() => onMarkRead(row.id)}
                        disabled={busy}
                      >
                        <CheckIcon className="size-4" aria-hidden />
                      </Button>
                    ) : null}
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t("delete")}
                      onClick={() => onDelete(row.id)}
                      disabled={busy}
                    >
                      <Trash2Icon className="size-4" aria-hidden />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

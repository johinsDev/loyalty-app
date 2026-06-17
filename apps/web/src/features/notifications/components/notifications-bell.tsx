"use client";

import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/lib/trpc/client";

import { useNotificationsDrawer } from "../hooks/use-notifications-drawer";

/**
 * Header bell that opens the notifications drawer and shows an unread dot from
 * the real feed (`notifications.unreadCount`). Replaces the old link to the
 * full-page /notifications inbox.
 */
export function NotificationsBell() {
  const t = useTranslations("Home");
  const trpc = useTRPC();
  const openDrawer = useNotificationsDrawer((s) => s.openDrawer);
  const unread = useQuery(trpc.notifications.unreadCount.queryOptions());
  const hasUnread = (unread.data ?? 0) > 0;

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={t("notificationsAria")}
      className="bg-card relative grid size-11 place-items-center rounded-full shadow-md shadow-black/5"
    >
      <Bell className="text-foreground size-5" />
      {hasUnread ? (
        <span className="ring-card absolute top-2.5 right-3 size-2.5 rounded-full bg-rose-400 ring-2" />
      ) : null}
    </button>
  );
}

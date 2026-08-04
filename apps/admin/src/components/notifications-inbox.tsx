"use client";

import { formatRelative } from "@loyalty/date";
import { Popover, PopoverContent, PopoverTrigger } from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import {
  alertIcon,
  entityHref,
  severityTone,
} from "@/features/admin-notifications/alert-meta";
import { Link } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

const PREVIEW_SIZE = 10;

/**
 * Notifications inbox — the bell in the sidebar footer. Vercel-style popover:
 * underlined Inbox/Archive tabs, circular tone icons, airy rows with a
 * right-aligned timestamp and an unread dot.
 *
 * Shows the newest few; the full list (filters, bulk actions, pagination)
 * lives at `/[storeId]/notificaciones`. Opening a row marks it read — the
 * mutation is fire-and-refetch rather than optimistic, matching the customer
 * feed, because the badge lying is worse than a beat of latency.
 */
export function NotificationsInbox() {
  const t = useTranslations("Inbox");
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"inbox" | "archive">("inbox");

  const unread = useQuery(trpc.adminNotifications.unreadCount.queryOptions());
  const list = useQuery({
    ...trpc.adminNotifications.listMine.queryOptions({
      tab,
      page: 1,
      perPage: PREVIEW_SIZE,
      sort: [],
    }),
    enabled: open,
  });

  const refresh = () =>
    queryClient.invalidateQueries(trpc.adminNotifications.pathFilter());

  const markRead = useMutation({
    ...trpc.adminNotifications.markRead.mutationOptions(),
    onSuccess: refresh,
  });
  const markAllRead = useMutation({
    ...trpc.adminNotifications.markAllRead.mutationOptions(),
    onSuccess: refresh,
  });
  const archive = useMutation({
    ...trpc.adminNotifications.archive.mutationOptions(),
    onSuccess: refresh,
  });
  const archiveAll = useMutation({
    ...trpc.adminNotifications.archiveAll.mutationOptions(),
    onSuccess: refresh,
  });

  const rows = list.data?.rows ?? [];
  const unreadCount = unread.data ?? 0;
  const busy =
    markRead.isPending ||
    markAllRead.isPending ||
    archive.isPending ||
    archiveAll.isPending;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        aria-label={t("title")}
        className="border-border bg-card text-muted-foreground hover:text-foreground relative grid size-9 flex-none place-items-center rounded-lg border"
      >
        <Bell className="size-4" />
        {unreadCount > 0 ? (
          <span className="bg-primary absolute top-1.5 right-1.5 size-2 rounded-full" />
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="center" side="top" className="w-96 rounded-xl p-0">
        <div className="border-border flex items-center gap-5 border-b px-4">
          <UnderlineTab active={tab === "inbox"} onClick={() => setTab("inbox")}>
            {t("inbox")}
            {unreadCount > 0 ? (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold">
                {unreadCount}
              </span>
            ) : null}
          </UnderlineTab>
          <UnderlineTab
            active={tab === "archive"}
            onClick={() => setTab("archive")}
          >
            {t("archive")}
          </UnderlineTab>
          <Link
            href="/campaigns"
            aria-label={t("settings")}
            title={t("settings")}
            className="text-muted-foreground hover:text-foreground ml-auto grid size-7 place-items-center rounded-md"
          >
            <Settings className="size-4" />
          </Link>
        </div>

        {list.isPending && open ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            {t("loading")}
          </p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground py-12 text-center text-sm">
            {tab === "inbox" ? t("empty") : t("archiveEmpty")}
          </p>
        ) : (
          <>
            <ul className="divide-border max-h-96 divide-y overflow-y-auto">
              {rows.map((n) => {
                const Icon = alertIcon(n.type);
                const href = entityHref(n.entityType, n.entityId);
                const body = (
                  <>
                    <span
                      className={`grid size-8 flex-none place-items-center rounded-full ${severityTone(n.severity)}`}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold">
                        {n.title}
                      </span>
                      <span className="text-muted-foreground block text-sm leading-relaxed">
                        {n.body}
                      </span>
                    </span>
                    <span className="text-muted-foreground/70 mt-0.5 flex flex-none items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                      {n.readAt ? null : (
                        <span className="bg-primary size-1.5 rounded-full" />
                      )}
                      {formatRelative(n.createdAt, { locale })}
                    </span>
                  </>
                );
                return (
                  <li key={n.id} className="hover:bg-muted/40">
                    {href ? (
                      <Link
                        href={href}
                        onClick={() => {
                          if (!n.readAt) markRead.mutate({ id: n.id });
                          setOpen(false);
                        }}
                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
                      >
                        {body}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (!n.readAt) markRead.mutate({ id: n.id });
                        }}
                        className="flex w-full items-start gap-3 px-4 py-3.5 text-left"
                      >
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="border-border grid grid-cols-2 border-t">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  tab === "inbox"
                    ? markAllRead.mutate(undefined)
                    : archiveAll.mutate(undefined)
                }
                className="border-border text-muted-foreground hover:text-foreground border-r py-3 text-center text-sm font-semibold disabled:opacity-50"
              >
                {tab === "inbox" ? t("markAllRead") : t("archiveAll")}
              </button>
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground py-3 text-center text-sm font-semibold"
              >
                {t("viewAll")}
              </Link>
            </div>
            {tab === "inbox" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => archive.mutate({ ids: rows.map((r) => r.id) })}
                className="border-border text-muted-foreground hover:text-foreground w-full border-t py-3 text-center text-sm font-semibold disabled:opacity-50"
              >
                {t("archiveAll")}
              </button>
            ) : null}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

function UnderlineTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative -mb-px flex items-center gap-1.5 border-b-2 py-3 text-sm font-semibold transition-colors ${
        active
          ? "border-foreground text-foreground"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

"use client";

import type { AdminAlertListItem } from "@loyalty/api/features/admin-notifications/schemas";
import { formatDateTime, formatRelative } from "@loyalty/date";
import { Button } from "@loyalty/ui";
import { Archive, ArchiveRestore, ArrowUpRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/nav";

import { alertIcon, entityHref, severityTone } from "../alert-meta";

/**
 * The body of an alert's detail panel: a tone-washed header carrying the same
 * icon + severity the row shows, the message, its metadata, and the actions
 * pinned to a bordered footer.
 *
 * Kept as its own component so the modal stays a thin shell — and so the row,
 * the header and the panel all read the alert's severity from one place.
 */
export function AlertDetail({
  alert,
  onArchive,
  onUnarchive,
  onNavigate,
}: {
  alert: AdminAlertListItem;
  onArchive: () => void;
  onUnarchive: () => void;
  /** Closes the panel when the deep link takes over. */
  onNavigate: () => void;
}) {
  const t = useTranslations("Inbox");
  const tt = useTranslations("Inbox.types");
  const ts = useTranslations("Inbox.severity");
  const locale = useLocale();

  const Icon = alertIcon(alert.type);
  const tone = severityTone(alert.severity);
  const href = entityHref(alert.entityType, alert.entityId);

  return (
    <div className="flex flex-col">
      <header className="border-border flex items-start gap-3 border-b px-5 py-4">
        <span className={`grid size-10 flex-none place-items-center rounded-full ${tone}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base leading-snug font-semibold">
            {alert.title}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs font-medium">
            {formatRelative(alert.createdAt, { locale })}
          </p>
        </div>
        <span
          className={`flex-none rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${tone}`}
        >
          {ts(alert.severity)}
        </span>
      </header>

      <div className="space-y-4 px-5 py-4">
        <p className="text-sm leading-relaxed">{alert.body}</p>

        <dl className="border-border grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border p-3 text-sm">
          <div className="min-w-0">
            <dt className="text-muted-foreground/80 text-[0.6875rem] font-bold tracking-wide uppercase">
              {t("colType")}
            </dt>
            <dd className="mt-0.5 truncate font-medium">{tt(alert.type)}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground/80 text-[0.6875rem] font-bold tracking-wide uppercase">
              {t("colWhen")}
            </dt>
            <dd className="mt-0.5 truncate font-medium">
              {formatDateTime(alert.createdAt, { locale })}
            </dd>
          </div>
        </dl>
      </div>

      <footer className="border-border flex items-center gap-2 border-t px-5 py-3">
        {href ? (
          <Link
            href={href}
            onClick={onNavigate}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors"
          >
            {t(`entity.${alert.entityType}`)}
            <ArrowUpRight className="size-4" />
          </Link>
        ) : null}
        {alert.archivedAt ? (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-9 gap-1.5 rounded-lg"
            onClick={onUnarchive}
          >
            <ArchiveRestore className="size-4" />
            {t("unarchive")}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-9 gap-1.5 rounded-lg"
            onClick={onArchive}
          >
            <Archive className="size-4" />
            {t("archiveSelected")}
          </Button>
        )}
      </footer>
    </div>
  );
}

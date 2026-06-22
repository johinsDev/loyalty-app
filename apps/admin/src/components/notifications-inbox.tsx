"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@loyalty/ui";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  type LucideIcon,
  Settings,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

type Note = {
  id: string;
  icon: LucideIcon;
  tone: "warn" | "ok" | "info";
  textKey: string;
  ago: string;
  unread?: boolean;
};

// Hardcoded inbox until the admin notifications feed is wired. Mirrors the
// ops/marketing events the owner cares about (promos, fraud, campaigns).
const INBOX: Note[] = [
  { id: "n1", icon: Sparkles, tone: "info", textKey: "promoLive", ago: "hoy", unread: true },
  { id: "n2", icon: AlertTriangle, tone: "warn", textKey: "fraudReplay", ago: "2 h", unread: true },
  { id: "n3", icon: CheckCircle2, tone: "ok", textKey: "campaignSent", ago: "ayer" },
  { id: "n4", icon: AlertTriangle, tone: "warn", textKey: "capReached", ago: "ayer" },
];

const TONE: Record<Note["tone"], string> = {
  warn: "bg-amber-500/15 text-amber-600",
  ok: "bg-emerald-500/15 text-emerald-600",
  info: "bg-primary/10 text-primary",
};

/**
 * Notifications inbox — a Vercel-style bell popover: wider panel, underlined
 * tabs (Inbox / Archive) with a settings gear, circular tone icons, airy rows
 * with a right-aligned timestamp + unread dot, and "Archive all". Lives in the
 * sidebar footer. Hardcoded for now; a plain state toggle keeps the layout
 * robust inside the popover.
 */
export function NotificationsInbox() {
  const t = useTranslations("Inbox");
  const [items, setItems] = useState(INBOX);
  const [tab, setTab] = useState<"inbox" | "archive">("inbox");
  const unread = items.filter((n) => n.unread).length;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={t("title")}
        className="border-border bg-card text-muted-foreground hover:text-foreground relative grid size-9 flex-none place-items-center rounded-lg border"
      >
        <Bell className="size-4" />
        {unread > 0 ? (
          <span className="bg-primary absolute top-1.5 right-1.5 size-2 rounded-full" />
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-96 rounded-xl p-0">
        <div className="border-border flex items-center gap-5 border-b px-4">
          <UnderlineTab active={tab === "inbox"} onClick={() => setTab("inbox")}>
            {t("inbox")}
            {unread > 0 ? (
              <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[0.625rem] font-bold">
                {unread}
              </span>
            ) : null}
          </UnderlineTab>
          <UnderlineTab
            active={tab === "archive"}
            onClick={() => setTab("archive")}
          >
            {t("archive")}
          </UnderlineTab>
          <button
            type="button"
            aria-label={t("settings")}
            className="text-muted-foreground hover:text-foreground ml-auto grid size-7 place-items-center rounded-md"
          >
            <Settings className="size-4" />
          </button>
        </div>

        {tab === "inbox" ? (
          items.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              {t("empty")}
            </p>
          ) : (
            <>
              <ul className="divide-border max-h-96 divide-y overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 px-4 py-3.5">
                    <span
                      className={`grid size-8 flex-none place-items-center rounded-full ${TONE[n.tone]}`}
                    >
                      <n.icon className="size-4" />
                    </span>
                    <p className="min-w-0 flex-1 text-sm leading-relaxed">
                      {t(n.textKey)}
                    </p>
                    <span className="text-muted-foreground/70 mt-0.5 flex flex-none items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
                      {n.unread ? (
                        <span className="bg-primary size-1.5 rounded-full" />
                      ) : null}
                      {n.ago}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setItems([])}
                className="border-border text-muted-foreground hover:text-foreground w-full border-t py-3 text-center text-sm font-semibold"
              >
                {t("archiveAll")}
              </button>
            </>
          )
        ) : (
          <p className="text-muted-foreground py-12 text-center text-sm">
            {t("archiveEmpty")}
          </p>
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

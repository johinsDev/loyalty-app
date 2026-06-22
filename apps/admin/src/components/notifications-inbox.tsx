"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@loyalty/ui";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  type LucideIcon,
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
 * Notifications inbox — a Vercel-style bell popover with an Inbox / Archive
 * toggle, a list of ops/marketing alerts, and "Archive all". Lives in the
 * sidebar footer. Hardcoded for now. Uses a plain state toggle (not the Tabs
 * primitive) to stay layout-robust inside the narrow popover.
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
      <PopoverContent align="end" side="top" className="w-80 rounded-xl p-0">
        <div className="border-border flex items-center gap-1 border-b px-3 py-2">
          <TabButton active={tab === "inbox"} onClick={() => setTab("inbox")}>
            {t("inbox")}
            {unread > 0 ? (
              <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[0.625rem] font-bold">
                {unread}
              </span>
            ) : null}
          </TabButton>
          <TabButton active={tab === "archive"} onClick={() => setTab("archive")}>
            {t("archive")}
          </TabButton>
        </div>

        {tab === "inbox" ? (
          items.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {t("empty")}
            </p>
          ) : (
            <>
              <ul className="divide-border max-h-80 divide-y overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id} className="flex items-start gap-3 px-3 py-3">
                    <span
                      className={`grid size-8 flex-none place-items-center rounded-lg ${TONE[n.tone]}`}
                    >
                      <n.icon className="size-4" />
                    </span>
                    <p className="min-w-0 flex-1 text-sm leading-snug">
                      {t(n.textKey)}
                    </p>
                    <span className="text-muted-foreground/70 flex flex-none items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
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
                className="border-border text-muted-foreground hover:text-foreground w-full border-t py-2.5 text-center text-sm font-semibold"
              >
                {t("archiveAll")}
              </button>
            </>
          )
        ) : (
          <p className="text-muted-foreground py-10 text-center text-sm">
            {t("archiveEmpty")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function TabButton({
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
      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

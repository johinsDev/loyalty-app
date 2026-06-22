"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@loyalty/ui";
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
 * Notifications inbox — a Vercel-style bell popover with Inbox / Archive tabs, a
 * list of ops/marketing alerts, and "Archive all". Lives in the sidebar footer.
 * Hardcoded for now.
 */
export function NotificationsInbox() {
  const t = useTranslations("Inbox");
  const [items, setItems] = useState(INBOX);
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
        <Tabs defaultValue="inbox">
          <div className="border-border flex items-center justify-between border-b px-3 pt-2">
            <TabsList className="bg-transparent p-0">
              <TabsTrigger value="inbox" className="gap-1.5">
                {t("inbox")}
                {unread > 0 ? (
                  <span className="bg-primary text-primary-foreground rounded-full px-1.5 text-[0.625rem] font-bold">
                    {unread}
                  </span>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="archive">{t("archive")}</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="inbox" className="m-0">
            {items.length === 0 ? (
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
                      <p className="flex-1 text-sm leading-snug">{t(n.textKey)}</p>
                      <span className="text-muted-foreground/70 flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
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
            )}
          </TabsContent>

          <TabsContent value="archive" className="m-0">
            <p className="text-muted-foreground py-10 text-center text-sm">
              {t("archiveEmpty")}
            </p>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}

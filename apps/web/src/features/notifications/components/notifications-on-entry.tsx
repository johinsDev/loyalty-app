"use client";

import { useSession } from "@loyalty/auth/client";
import { Button } from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Confetti } from "@/features/auth/components/confetti";
import { EmojiTile } from "@/features/auth/components/emoji-tile";
import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { useNotificationsDrawer } from "../hooks/use-notifications-drawer";

/** Notification types that warrant the full-screen confetti celebration. */
const CELEBRATORY = new Set(["first-purchase", "welcome"]);
const SESSION_KEY = "t4-notif-onentry-shown";

type Celebration = { id: string; title: string; body: string };

/**
 * On entry, surfaces unread in-app notifications once per session: a celebratory
 * type (first purchase / welcome) pops a confetti modal; anything else opens the
 * notifications drawer. Dismissing marks the celebrated notification read.
 * Mounted once in the locale layout; renders nothing until it has something.
 */
export function NotificationsOnEntry() {
  const t = useTranslations("Notifications");
  const trpc = useTRPC();
  const { data: session } = useSession();
  const customerId = session?.user?.id ?? null;
  const openDrawer = useNotificationsDrawer((s) => s.openDrawer);
  const markRead = useMutation(trpc.notifications.markRead.mutationOptions());
  const [celebration, setCelebration] = useState<Celebration | null>(null);

  const unreadQ = useQuery({
    ...trpc.notifications.listMine.queryOptions({
      filter: "unread",
      page: 1,
      pageSize: 10,
    }),
    enabled: !!customerId,
  });

  const rows = unreadQ.data?.rows;

  useEffect(() => {
    if (!customerId || !rows || rows.length === 0) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");

    const top = rows[0]!;
    if (CELEBRATORY.has(top.type)) {
      setCelebration({ id: top.id, title: top.title, body: top.body });
    } else {
      openDrawer();
    }
  }, [customerId, rows, openDrawer]);

  if (!celebration) return null;

  const dismiss = () => {
    void markRead.mutateAsync({ id: celebration.id });
    setCelebration(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-7"
      role="dialog"
      aria-modal
    >
      <button
        type="button"
        aria-label={t("notNow")}
        onClick={dismiss}
        className="absolute inset-0 bg-black/50"
      />
      <Confetti />
      <div className="bg-card relative z-10 flex w-full max-w-sm flex-col items-center rounded-3xl p-8 text-center shadow-2xl">
        <EmojiTile size="lg">🎉</EmojiTile>
        <h2 className="font-display text-foreground mt-5 mb-1.5 text-2xl font-semibold tracking-tight">
          {celebration.title}
        </h2>
        <p className="text-muted-foreground mb-5 text-sm">{celebration.body}</p>
        <div className="from-primary/5 to-primary/20 mb-5 inline-flex items-center rounded-full bg-gradient-to-br px-6 py-3">
          <span className="font-display text-primary text-xl font-semibold">
            {t("stampPill")}
          </span>
        </div>
        <Button
          variant="gradient"
          className="h-14 w-full rounded-full text-base font-bold"
          render={<Link href="/card" onClick={dismiss} />}
        >
          {t("viewCard")}
        </Button>
        <button
          type="button"
          onClick={dismiss}
          className="text-muted-foreground mt-2 h-11 text-sm font-semibold"
        >
          {t("notNow")}
        </button>
      </div>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useTRPC } from "@/lib/trpc/client";

/** Strips a badge this component added, so it never compounds: "(2) (1) X". */
const stripBadge = (title: string) => title.replace(/^\(\d+\)\s*/, "");

/**
 * Puts the unread count in the browser tab — "(3) Loyalty CRM" — the way
 * YouTube and Gmail do.
 *
 * The shop runs the panel on a tablet all day in another tab; the sidebar bell
 * is invisible there, and this is the only surface that reaches someone who
 * isn't looking at the app.
 *
 * Next rewrites `document.title` on every navigation from route metadata, so a
 * plain effect would lose the badge on the next route change. A MutationObserver
 * on the `<title>` node reapplies it whenever that happens.
 *
 * Renders nothing.
 */
export function UnreadTitleBadge() {
  const trpc = useTRPC();
  const { data: unread } = useQuery(
    trpc.adminNotifications.unreadCount.queryOptions(),
  );
  const count = unread ?? 0;

  useEffect(() => {
    const titleEl = document.querySelector("title");
    if (!titleEl) return;

    const apply = () => {
      const base = stripBadge(document.title);
      const next = count > 0 ? `(${count}) ${base}` : base;
      if (document.title !== next) document.title = next;
    };

    apply();
    // Reapply after Next swaps the title on navigation. Our own write retriggers
    // the observer, but `apply` is idempotent so it settles immediately.
    const observer = new MutationObserver(apply);
    observer.observe(titleEl, { childList: true, characterData: true, subtree: true });

    return () => {
      observer.disconnect();
      document.title = stripBadge(document.title);
    };
  }, [count]);

  return null;
}

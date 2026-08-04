"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useCallback, useRef } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import { useOrgRoom } from "../hooks/use-org-room";

/**
 * Keeps the admin alert inbox live, and surfaces an arrival as a toast.
 *
 * The room broadcasts one `admin.alert` signal per alert, org-wide and
 * content-free. Everyone connected refetches their own inbox; the rows they
 * get back are already filtered by `user_id` in SQL, so an operator who wasn't
 * a recipient simply gets nothing back — and therefore no toast. That is why
 * the toast is built from the refetched row and never from the socket frame:
 * the socket is shared, the data isn't.
 *
 * Renders nothing; mounted next to the bell, which is always in the sidebar.
 */
export function OrgAlertsListener() {
  const t = useTranslations("Inbox");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: me } = useQuery(trpc.auth.me.queryOptions());

  // The newest unread alert we've already announced, so a burst of signals
  // doesn't stack duplicate toasts for the same row.
  const lastAnnounced = useRef<string | null>(null);

  const announceLatest = useCallback(async () => {
    const latest = await queryClient.fetchQuery(
      trpc.adminNotifications.listMine.queryOptions({
        tab: "inbox",
        read: "unread",
        page: 1,
        perPage: 1,
        sort: [],
      }),
    );
    const row = latest.rows[0];
    // No row = the alert wasn't addressed to me. Nothing to show.
    if (!row || lastAnnounced.current === row.id) return;
    lastAnnounced.current = row.id;

    const show =
      row.severity === "critical"
        ? toast.error
        : row.severity === "warning"
          ? toast.warning
          : row.severity === "success"
            ? toast.success
            : toast.info;

    show(row.title, {
      description: row.body,
      action: {
        label: t("toastAction"),
        onClick: () => router.push("/notifications"),
      },
    });
  }, [queryClient, trpc, t, router]);

  const onEvent = useCallback(
    (event: { event: string }) => {
      // Only a live signal triggers a look. Nothing runs on mount, so the
      // shell doesn't pay an extra round trip just to have this mounted.
      if (event.event !== "admin.alert") return;
      void queryClient.invalidateQueries(trpc.adminNotifications.pathFilter());
      void announceLatest();
    },
    [announceLatest, queryClient, trpc],
  );

  useOrgRoom({
    organizationId: me?.organizationId ?? null,
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST,
    onEvent,
  });

  return null;
}

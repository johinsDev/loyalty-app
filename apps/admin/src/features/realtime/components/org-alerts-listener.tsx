"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/lib/trpc/client";

import { useOrgRoom } from "../hooks/use-org-room";

/**
 * Keeps the admin alert inbox live.
 *
 * The room broadcasts one `admin.alert` signal per alert, org-wide and
 * content-free. Everyone connected refetches their own inbox; the rows they
 * get back are already filtered by `user_id` in SQL, so an operator who
 * wasn't a recipient simply sees nothing new. That's why the signal carries
 * no title or body — the socket is shared, the data isn't.
 *
 * Renders nothing; mounted next to the bell, which is always in the sidebar.
 */
export function OrgAlertsListener() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: me } = useQuery(trpc.auth.me.queryOptions());

  const onEvent = useCallback(
    (event: { event: string }) => {
      if (event.event !== "admin.alert") return;
      void queryClient.invalidateQueries(
        trpc.adminNotifications.pathFilter(),
      );
    },
    [queryClient, trpc],
  );

  useOrgRoom({
    organizationId: me?.organizationId ?? null,
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST,
    onEvent,
  });

  return null;
}

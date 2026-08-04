"use client";

import { usePartyRoom, type RealtimeEvent } from "@loyalty/realtime/client";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { useTRPC } from "@/lib/trpc/client";

interface Args<E extends RealtimeEvent> {
  /** The org whose room we listen to. Pass `null` to disable the hook. */
  organizationId: string | null;
  /** PartyKit host from `NEXT_PUBLIC_PARTYKIT_HOST`. Disabled when missing. */
  host: string | undefined;
  onEvent?: (event: E) => void;
}

/**
 * Subscribe to the shop's real-time room (`org:<id>`) — the channel every
 * operator shares.
 *
 * Only signals travel here, never content: an `admin.alert` frame carries
 * `{type, severity}` and the client refetches its own inbox, which SQL has
 * already filtered by user. See `partykit/src/parties/org.ts`.
 *
 * The API only mints a ticket for staff of this org, so a customer session
 * can't join. MUST be used inside a tree with `<TRPCProvider />`.
 */
export function useOrgRoom<E extends RealtimeEvent = RealtimeEvent>({
  organizationId,
  host,
  onEvent,
}: Args<E>) {
  const trpc = useTRPC();
  const issueTicket = useMutation(trpc.realtime.issueTicket.mutationOptions());

  const roomId = organizationId ? (`org:${organizationId}` as const) : null;

  const getTicket = useCallback(
    async (room: `customer:${string}` | `org:${string}` | `chat:${string}`) => {
      return issueTicket.mutateAsync({ roomId: room });
    },
    [issueTicket],
  );

  // partysocket only speaks `ws://` for non-TLS hosts (local dev on
  // 127.0.0.1:1999). Production always uses `wss://`.
  const protocol = useMemo<"ws" | "wss" | undefined>(() => {
    if (!host) return undefined;
    return /^(127\.0\.0\.1|localhost)/.test(host) ? "ws" : "wss";
  }, [host]);

  return usePartyRoom<E>(host && roomId ? roomId : null, {
    host: host ?? "",
    protocol,
    getTicket,
    onEvent,
  });
}

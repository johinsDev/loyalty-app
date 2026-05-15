"use client";

import { useMutation } from "@tanstack/react-query";
import { usePartyRoom, type RealtimeEvent } from "@loyalty/realtime/client";
import { useCallback, useMemo } from "react";

import { useTRPC } from "@/lib/trpc/client";

interface Args<E extends RealtimeEvent> {
  /** The customer id we want to listen to. Pass `null` to disable the hook. */
  customerId: string | null;
  /** PartyKit host from `NEXT_PUBLIC_PARTYKIT_HOST`. Disabled when missing. */
  host: string | undefined;
  /** Optional event sink — runs for every received event including server-side `connection.ready`. */
  onEvent?: (event: E) => void;
}

/**
 * Subscribe to the customer's own real-time room (`customer:<id>`).
 *
 * Auth flow handled transparently:
 *   1. Calls `api.realtime.issueTicket` to get a short-lived JWT
 *   2. Connects the WebSocket with `?token=<jwt>`
 *   3. Re-issues before expiry (5-minute TTL)
 *
 * MUST be used inside a component tree that has `<TRPCProvider />`.
 *
 * @example
 *   const { status, lastEvent } = useCustomerRoom<StampEarned>({
 *     customerId: customer.id,
 *     host: process.env.NEXT_PUBLIC_PARTYKIT_HOST,
 *     onEvent: (e) => { if (e.event === "stamp.earned") refetch(); },
 *   });
 */
export function useCustomerRoom<E extends RealtimeEvent = RealtimeEvent>({
  customerId,
  host,
  onEvent,
}: Args<E>) {
  const trpc = useTRPC();
  const issueTicket = useMutation(trpc.realtime.issueTicket.mutationOptions());

  const roomId = customerId ? (`customer:${customerId}` as const) : null;

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

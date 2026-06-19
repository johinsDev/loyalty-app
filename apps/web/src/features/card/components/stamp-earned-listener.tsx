"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { useCustomerRoom } from "@/features/realtime/hooks/use-customer-room";
import { Celebrate } from "@/lib/celebrate";

interface Props {
  customerId: string;
  partykitHost: string | undefined;
}

interface StampEarnedEvent {
  event: "stamp.earned";
  data: { totalStamps: number; amount: number; cardId: string };
  emittedAt: string;
}

/**
 * Client wrapper around the customer real-time room. When the cashier
 * publishes `stamp.earned`, this component:
 *   1. Triggers a router refresh so the (server-rendered) card data
 *      re-fetches — the user sees the new total without reloading
 *   2. Pops a transient celebration banner for ~3s
 *
 * Drop into any server-rendered page that wants to live-update on
 * loyalty events; pass the customer id from the auth context.
 *
 * If `partykitHost` is undefined (realtime not configured), the
 * component renders nothing — graceful degradation.
 */
export function StampEarnedListener({ customerId, partykitHost }: Props) {
  const router = useRouter();
  const [banner, setBanner] = useState<ReactNode>(null);
  const [celebrating, setCelebrating] = useState(false);

  useCustomerRoom<StampEarnedEvent>({
    customerId,
    host: partykitHost,
    onEvent: (event) => {
      if (event.event !== "stamp.earned") return;
      router.refresh();
      setCelebrating(true);
      setBanner(
        <span>
          ¡Sumaste{" "}
          <strong>
            {event.data.amount} sello{event.data.amount === 1 ? "" : "s"}
          </strong>
          ! Total: <strong>{event.data.totalStamps}</strong>
        </span>,
      );
      window.setTimeout(() => setBanner(null), 3500);
    },
  });

  if (!banner && !celebrating) return null;
  return (
    <>
      {celebrating ? (
        <div className="pointer-events-none fixed inset-0 z-50">
          <Celebrate distance={900} onDone={() => setCelebrating(false)} />
        </div>
      ) : null}
      {banner ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 shadow-lg backdrop-blur dark:text-emerald-100"
        >
          {banner}
        </div>
      ) : null}
    </>
  );
}

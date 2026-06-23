"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { useCustomerRoom } from "@/features/realtime/hooks/use-customer-room";
import { Celebrate } from "@/lib/celebrate";
import { useTRPC } from "@/lib/trpc/client";

interface Props {
  customerId: string;
  partykitHost: string | undefined;
}

interface SellosEvent {
  event: "stamp.earned" | "reward.claimed";
  data: {
    walletId?: string | null;
    currentStamps?: number;
    walletSize?: number;
    completed?: boolean;
  };
  emittedAt: string;
}

/**
 * Live updates for the card. On `stamp.earned` / `reward.claimed` it invalidates
 * the sellos queries (so `<CardLive />` refetches the new state) and pops a
 * transient celebration. No-op when realtime isn't configured.
 */
export function StampEarnedListener({ customerId, partykitHost }: Props) {
  const t = useTranslations("Card");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const closeQr = useQrDrawer((s) => s.setOpen);
  const [banner, setBanner] = useState<ReactNode>(null);
  const [celebrating, setCelebrating] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries(trpc.stamps.myWallet.queryFilter());
    void queryClient.invalidateQueries(trpc.stamps.myHistory.queryFilter());
    void queryClient.invalidateQueries(
      trpc.stamps.myCompletedWallets.queryFilter(),
    );
  };

  useCustomerRoom<SellosEvent>({
    customerId,
    host: partykitHost,
    onEvent: (event) => {
      if (event.event === "stamp.earned") {
        refresh();
        setCelebrating(true);
        setBanner(
          event.data.completed ? t("completedBanner") : t("earnedBanner"),
        );
        window.setTimeout(() => setBanner(null), 3500);
      } else if (event.event === "reward.claimed") {
        // The cashier confirmed the claim — close the QR drawer so the
        // celebration + fresh card are visible, not hidden behind it.
        closeQr(false);
        refresh();
        setCelebrating(true);
        setBanner(t("claimedBanner"));
        window.setTimeout(() => setBanner(null), 3500);
      }
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
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-center text-sm font-semibold text-emerald-900 shadow-lg backdrop-blur dark:text-emerald-100"
        >
          {banner}
        </div>
      ) : null}
    </>
  );
}

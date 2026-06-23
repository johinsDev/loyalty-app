"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { useCustomerRoom } from "@/features/realtime/hooks/use-customer-room";
import { Celebrate } from "@/lib/celebrate";
import { useTRPC } from "@/lib/trpc/client";

import { StreakClaimCelebration } from "./streak-claim-celebration";

interface Props {
  customerId: string;
  partykitHost: string | undefined;
}

interface StreakEvent {
  event: "streak.advanced" | "streak.completed" | "streak.reward.claimed";
  data: { currentCount?: number; streakId?: string };
  emittedAt: string;
}

/**
 * Live updates for the streak card. `streak.advanced` invalidates the streak so
 * the day lights up; `streak.completed` pops a celebration + nudge (the
 * persistent reward banner takes over after); `streak.reward.claimed` closes the
 * QR drawer and plays the claim celebration. No-op when realtime isn't wired.
 */
export function StreakListener({ customerId, partykitHost }: Props) {
  const t = useTranslations("Home");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const closeQr = useQrDrawer((s) => s.setOpen);
  const [banner, setBanner] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const refresh = () => {
    void queryClient.invalidateQueries(trpc.streaks.myStreak.queryFilter());
    void queryClient.invalidateQueries(trpc.streaks.myHistory.queryFilter());
  };

  useCustomerRoom<StreakEvent>({
    customerId,
    host: partykitHost,
    onEvent: (event) => {
      if (event.event === "streak.advanced") {
        refresh();
      } else if (event.event === "streak.completed") {
        refresh();
        setCelebrating(true);
        setBanner(t("streakCompletedBanner"));
        window.setTimeout(() => setBanner(null), 4000);
      } else if (event.event === "streak.reward.claimed") {
        // The cashier confirmed — close the QR so the celebration is visible.
        closeQr(false);
        refresh();
        window.setTimeout(() => setClaimed(true), 1000);
      }
    },
  });

  return (
    <>
      <StreakClaimCelebration open={claimed} onClose={() => setClaimed(false)} />
      {celebrating ? (
        <div className="pointer-events-none fixed inset-0 z-50">
          <Celebrate distance={900} onDone={() => setCelebrating(false)} />
        </div>
      ) : null}
      {banner ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 text-center text-sm font-semibold text-orange-900 shadow-lg backdrop-blur dark:text-orange-100"
        >
          {banner}
        </div>
      ) : null}
    </>
  );
}

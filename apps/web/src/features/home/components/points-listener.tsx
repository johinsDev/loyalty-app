"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useCustomerRoom } from "@/features/realtime/hooks/use-customer-room";
import { useTRPC } from "@/lib/trpc/client";

import { type CelebratedTier, TierCelebration } from "./tier-celebration";

interface Props {
  customerId: string;
  partykitHost: string | undefined;
}

interface PointsEvent {
  event: "points.earned" | "tier.changed";
  data: {
    earned?: number;
    balance?: number;
    direction?: "up" | "down";
    tier?: CelebratedTier & { key: string; icon?: string };
  };
  emittedAt: string;
}

/**
 * Live updates for the points card. `points.earned` invalidates the summary +
 * history so the ring animates; `tier.changed` up pops the level-up celebration
 * (tier details ride on the event), down shows a brief banner. No-op when
 * realtime isn't wired.
 */
export function PointsListener({ customerId, partykitHost }: Props) {
  const t = useTranslations("Home");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [celebrate, setCelebrate] = useState<CelebratedTier | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries(trpc.points.mySummary.queryFilter());
    void queryClient.invalidateQueries(trpc.points.myHistory.queryFilter());
  };

  useCustomerRoom<PointsEvent>({
    customerId,
    host: partykitHost,
    onEvent: (event) => {
      if (event.event === "points.earned") {
        refresh();
      } else if (event.event === "tier.changed") {
        refresh();
        if (event.data.direction === "up" && event.data.tier) {
          setCelebrate({
            name: event.data.tier.name,
            color: event.data.tier.color,
            benefits: event.data.tier.benefits ?? [],
            terms: event.data.tier.terms ?? null,
          });
        } else if (event.data.direction === "down" && event.data.tier) {
          setBanner(t("tierDownBanner", { tier: event.data.tier.name }));
          window.setTimeout(() => setBanner(null), 4000);
        }
      }
    },
  });

  return (
    <>
      <TierCelebration tier={celebrate} onClose={() => setCelebrate(null)} />
      {banner ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center text-sm font-semibold text-amber-900 shadow-lg backdrop-blur dark:text-amber-100"
        >
          {banner}
        </div>
      ) : null}
    </>
  );
}

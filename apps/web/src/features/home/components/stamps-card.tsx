"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { CupSoda, Gift } from "lucide-react";
import { useTranslations } from "next-intl";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { useTRPC } from "@/lib/trpc/client";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Stamp wallet — a 5×2 grid where every Nth stamp is a free drink. Reads the
 * customer's real wallet (`stamps.myWallet`) via `useSuspenseQuery` (the parent
 * `<Suspense>` shows `<StampsCardSkeleton />`; the realtime listener invalidates
 * it so a new stamp pops in live). When the card is full the reward stamp glows
 * and tapping it opens the QR drawer to claim. Stamps fade + pop in on mount.
 */
export function StampsCard() {
  const t = useTranslations("Home");
  const trpc = useTRPC();
  const setQrOpen = useQrDrawer((s) => s.setOpen);
  const reduced = useReducedMotion();

  const { data: w } = useSuspenseQuery(trpc.stamps.myWallet.queryOptions());
  const filled = w.currentStamps;
  const total = w.walletSize;
  const remaining = Math.max(0, total - filled);
  const stamps = Array.from({ length: total }, (_, i) => i + 1);

  const enter = (i: number) =>
    reduced
      ? undefined
      : ({
          animation: "tw-zoom-in 0.45s ease-out backwards",
          animationDelay: `${i * 45}ms`,
        } as const);

  return (
    <section className="bg-card rounded-3xl p-6 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
      <style>{`@keyframes tw-zoom-in{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}@keyframes t4StampGlow{0%,100%{box-shadow:0 6px 14px -4px rgba(251,191,36,.5)}50%{box-shadow:0 8px 22px 0 rgba(251,191,36,.85)}}`}</style>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-display text-foreground text-xl font-semibold tracking-tight">
          {t("stampsTitle")}
        </span>
        <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-extrabold whitespace-nowrap">
          {t("stampsCount", { filled, total })}
        </span>
      </div>
      <p className="text-primary mb-4 text-sm font-semibold">
        {w.rewardPending ? t("rewardReady") : t("stampsRemaining", { count: remaining })}
      </p>
      <div className="grid grid-cols-5 gap-3">
        {stamps.map((n) => {
          const isReward = n === total;
          const isFilled = n <= filled;
          const isLatest = n === filled;
          const claimable = isReward && w.rewardPending;
          return (
            <button
              key={n}
              type="button"
              onClick={claimable ? () => setQrOpen(true) : undefined}
              aria-label={
                isReward
                  ? t("stampRewardTitle")
                  : isFilled
                    ? t("stampFilledTitle")
                    : t("stampEmptyTitle")
              }
              style={enter(n - 1)}
              className={`grid aspect-square place-items-center rounded-full text-xs font-bold transition-transform ${
                claimable ? "active:scale-90" : "cursor-default"
              } ${
                isReward
                  ? "bg-gradient-to-br from-amber-300 to-amber-400 text-white shadow-md shadow-amber-400/40"
                  : isFilled
                    ? "bg-primary text-white shadow-md shadow-primary/40"
                    : "border-primary/30 bg-primary/5 text-primary/50 border-2 border-dashed"
              }`}
            >
              <span
                style={
                  isReward && !reduced
                    ? { animation: "t4StampGlow 2.4s ease-in-out infinite" }
                    : undefined
                }
                className={`grid size-full place-items-center rounded-full ${
                  isLatest && !isReward && !reduced
                    ? "motion-safe:animate-in motion-safe:zoom-in-50"
                    : ""
                }`}
              >
                {isReward ? (
                  <Gift className="size-5" />
                ) : isFilled ? (
                  <CupSoda className="size-5" />
                ) : (
                  n
                )}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

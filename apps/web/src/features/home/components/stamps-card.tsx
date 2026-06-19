"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@loyalty/ui";
import { CupSoda, Gift } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useReducedMotion } from "@/lib/use-reduced-motion";

import { stampPurchases, stampsWallet } from "../data";

type Selected =
  | { kind: "filled"; n: number }
  | { kind: "empty"; n: number }
  | { kind: "reward" };

/**
 * Stamp wallet — a 5×2 grid where every Nth stamp is a free drink. Stamps fade
 * and pop in on mount (staggered), the reward stamp keeps a soft glow, and the
 * most recently earned stamp does a one-time pop so the card feels alive.
 * Tapping a stamp opens a drawer: a filled stamp reveals the purchase that
 * earned it, an empty one shows how many are left, and the reward shows the
 * prize. Client component (animations + taps). Distinct white card so it reads
 * apart from the mint points card ({@link PointsCard}).
 */
export function StampsCard() {
  const t = useTranslations("Home");
  const { filled, total, remaining } = stampsWallet;
  const stamps = Array.from({ length: total }, (_, i) => i + 1);
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<Selected | null>(null);

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
        {t("stampsRemaining", { count: remaining })}
      </p>
      <div className="grid grid-cols-5 gap-3">
        {stamps.map((n) => {
          const isReward = n === total;
          const isFilled = n <= filled;
          const isLatest = n === filled;
          return (
            <button
              key={n}
              type="button"
              onClick={() =>
                setSelected(
                  isReward
                    ? { kind: "reward" }
                    : isFilled
                      ? { kind: "filled", n }
                      : { kind: "empty", n },
                )
              }
              aria-label={
                isReward
                  ? t("stampRewardTitle")
                  : isFilled
                    ? t("stampFilledTitle")
                    : t("stampEmptyTitle")
              }
              style={enter(n - 1)}
              className={`grid aspect-square place-items-center rounded-full text-xs font-bold transition-transform active:scale-90 ${
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

      <Drawer
        open={selected !== null}
        onOpenChange={(next) => !next && setSelected(null)}
      >
        <DrawerContent className="mx-auto w-full max-w-md lg:max-w-lg">
          <StampDetail selected={selected} />
        </DrawerContent>
      </Drawer>
    </section>
  );
}

function StampDetail({ selected }: { selected: Selected | null }) {
  const t = useTranslations("Home");
  if (!selected) return null;

  if (selected.kind === "reward") {
    return (
      <>
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-display text-2xl font-semibold tracking-tight">
            {t("stampRewardTitle")}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-400 p-5 text-white shadow-md shadow-amber-400/40">
            <Gift className="size-9 flex-none" />
            <p className="text-sm font-semibold">{t("stampDetailReward")}</p>
          </div>
        </div>
      </>
    );
  }

  if (selected.kind === "empty") {
    return (
      <>
        <DrawerHeader className="text-left">
          <DrawerTitle className="font-display text-2xl font-semibold tracking-tight">
            {t("stampEmptyTitle")}
          </DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-6">
          <div className="text-muted-foreground border-primary/30 bg-primary/5 rounded-2xl border-2 border-dashed p-5 text-sm font-semibold">
            {t("stampDetailEmpty", { count: stampsWallet.total - selected.n + 1 })}
          </div>
        </div>
      </>
    );
  }

  const purchase = stampPurchases[selected.n];
  return (
    <>
      <DrawerHeader className="text-left">
        <DrawerTitle className="font-display text-2xl font-semibold tracking-tight">
          {t("stampFilledTitle")}
        </DrawerTitle>
        <DrawerDescription>{purchase?.meta}</DrawerDescription>
      </DrawerHeader>
      <div className="px-4 pb-6">
        <div className="bg-card flex items-center gap-4 rounded-2xl p-4 ring-1 ring-black/5 dark:ring-white/10">
          <span className="from-primary/10 to-primary/5 grid size-14 flex-none place-items-center rounded-2xl bg-gradient-to-br text-2xl">
            {purchase?.emoji ?? "🧋"}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-foreground text-base font-bold">
              {purchase?.drink}
            </span>
            {purchase ? (
              <span className="bg-primary/10 text-primary inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-extrabold">
                {t("stampPointsEarned", { points: purchase.points })}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

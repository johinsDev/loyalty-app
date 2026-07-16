"use client";

import { motion } from "motion/react";

import { balanceSizeClass, CountUp, PausedNotice, PressArea, TierIcon, usePrefersReducedMotion } from "./shared";
import type { PointsCardView } from "./types";

const WAVE_PATH =
  "M0 20 Q 25 8 50 20 T 100 20 T 150 20 T 200 20 V 120 H 0 Z";

/** Template #6 — "Marea": the progress IS the card — a liquid brand-color
 *  tide filling from the bottom, waves rolling sideways. */
export function WavePointsCard({ view }: { view: PointsCardView }) {
  const reduced = usePrefersReducedMotion();
  const balanceLabel = view.formatBalance(view.balance);
  const fill = view.pausedLabel ? 0.12 : 0.12 + view.progress * 0.5;

  const wave = (opacity: number, duration: number, delay: number) => (
    <motion.div
      aria-hidden
      className="absolute bottom-0 left-0 h-full w-[200%]"
      style={{ height: `${fill * 100}%` }}
      animate={reduced ? undefined : { x: ["0%", "-50%"] }}
      transition={{ duration, delay, repeat: Infinity, ease: "linear" }}
    >
      <svg viewBox="0 0 200 120" preserveAspectRatio="none" className="size-full">
        <path d={WAVE_PATH} fill="var(--primary)" fillOpacity={opacity} />
      </svg>
    </motion.div>
  );

  return (
    <section className="bg-background ring-border relative overflow-hidden rounded-3xl shadow-xl shadow-black/10 ring-1">
      {wave(0.25, 7, 0)}
      {wave(0.5, 5, 0.6)}

      <PressArea
        view={view}
        className="relative z-10 flex w-full flex-col items-center p-7 transition-transform active:scale-[0.98]"
      >
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
          <TierIcon iconKey={view.tierIconKey} className="size-3.5" style={{ color: view.tierColor }} />
          {view.tierName}
        </span>
        <span className={`font-display mt-3 font-semibold tracking-tight ${balanceSizeClass(balanceLabel)}`}>
          <CountUp value={view.balance} format={view.formatBalance} />
        </span>
        {view.pausedLabel ? (
          <PausedNotice view={view} />
        ) : (
          <p className="text-primary mt-2 mb-8 text-sm font-semibold">
            {view.nextLabel ?? view.maxLabel}
          </p>
        )}
        {!view.pausedLabel && view.nextTierName ? (
          <div className="flex w-full items-center justify-between text-xs font-bold">
            <span className="inline-flex items-center gap-1">
              <TierIcon iconKey={view.tierIconKey} className="size-3.5" style={{ color: view.tierColor }} />
              {view.tierName}
            </span>
            <span className="opacity-70">
              {view.nextTierName}
              {view.nextThreshold != null ? ` · ${view.nextThreshold}` : ""}
            </span>
          </div>
        ) : null}
      </PressArea>
    </section>
  );
}

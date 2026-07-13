"use client";

import { motion } from "motion/react";

import { balanceSizeClass, CountUp, PausedNotice, TierIcon, usePrefersReducedMotion } from "./shared";
import type { PointsCardView } from "./types";

/** Deterministic pearl layout (no Math.random — SSR-stable). */
const PEARLS = [
  { left: "12%", size: 10, delay: 0, dur: 7 },
  { left: "26%", size: 7, delay: 1.8, dur: 8.5 },
  { left: "43%", size: 12, delay: 0.9, dur: 6.5 },
  { left: "58%", size: 8, delay: 2.6, dur: 9 },
  { left: "72%", size: 11, delay: 0.4, dur: 7.5 },
  { left: "86%", size: 6, delay: 1.3, dur: 8 },
];

/** Template #5 — "Burbujas festivas": brand-teal bubble-tea card with boba
 *  pearls drifting up and the progress bar as a filling glass. */
export function BubblesPointsCard({ view }: { view: PointsCardView }) {
  const reduced = usePrefersReducedMotion();
  const balanceLabel = view.formatBalance(view.balance);

  return (
    <section className="from-primary to-primary/70 relative overflow-hidden rounded-3xl bg-gradient-to-b p-7 text-white shadow-xl shadow-primary/30">
      {/* Boba pearls floating up */}
      {!reduced
        ? PEARLS.map((p) => (
            <motion.span
              key={p.left}
              aria-hidden
              className="pointer-events-none absolute rounded-full bg-black/25"
              style={{ left: p.left, width: p.size, height: p.size, bottom: -16 }}
              animate={{ y: [0, -260], opacity: [0, 0.8, 0] }}
              transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "linear" }}
            />
          ))
        : null}

      <button
        type="button"
        onClick={view.onPress}
        aria-label={view.detailAriaLabel}
        className="relative z-10 flex w-full flex-col items-center transition-transform active:scale-[0.98]"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold">
          <TierIcon iconKey={view.tierIconKey} className="size-3.5" />
          {view.tierName}
        </span>
        <span className={`font-display mt-4 font-semibold tracking-tight ${balanceSizeClass(balanceLabel)}`}>
          <CountUp value={view.balance} format={view.formatBalance} />
        </span>
        {view.pausedLabel ? (
          <PausedNotice view={view} light />
        ) : (
          <p className="mt-2 text-sm font-semibold text-white/85">
            {view.nextLabel ?? view.maxLabel}
          </p>
        )}
      </button>

      {!view.pausedLabel && view.nextTierName ? (
        <div className="relative z-10 mt-5">
          {/* The "glass": a rounded track that fills like a drink. */}
          <div className="h-4 overflow-hidden rounded-full border border-white/30 bg-white/10">
            <motion.div
              className="relative h-full rounded-full bg-white/80"
              initial={{ width: 0 }}
              animate={{ width: `${view.progress * 100}%` }}
              transition={reduced ? { duration: 0 } : { duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
            >
              <span aria-hidden className="absolute top-1/2 right-1 size-2 -translate-y-1/2 rounded-full bg-black/30" />
            </motion.div>
          </div>
          <div className="mt-1.5 flex justify-between text-[0.7rem] font-bold text-white/70">
            <span>{view.tierName}</span>
            <span>
              {view.nextTierName}
              {view.nextThreshold != null ? ` · ${view.nextThreshold}` : ""}
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

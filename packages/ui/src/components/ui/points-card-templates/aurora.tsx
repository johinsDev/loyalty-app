"use client";

import { motion } from "motion/react";

import { balanceSizeClass, CountUp, PausedNotice, PressArea, TierIcon, usePrefersReducedMotion } from "./shared";
import type { PointsCardView } from "./types";

/** Template #2 — "Aurora líquida": soft blobs of the tier color drifting
 *  slowly behind a glassy card. Calm, premium. */
export function AuroraPointsCard({ view }: { view: PointsCardView }) {
  const reduced = usePrefersReducedMotion();
  const balanceLabel = view.formatBalance(view.balance);

  const drift = (dx: number, dy: number) =>
    reduced
      ? undefined
      : {
          x: [0, dx, -dx / 2, 0],
          y: [0, dy, -dy, 0],
          scale: [1, 1.15, 0.95, 1],
        };

  return (
    <section className="from-primary/10 via-background to-primary/5 relative overflow-hidden rounded-3xl bg-gradient-to-br p-7 shadow-xl shadow-black/10">
      {/* Aurora blobs — tier color + brand, blurred and drifting. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-10 -left-10 size-48 rounded-full opacity-30 blur-3xl"
        style={{ background: view.tierColor }}
        animate={drift(40, 25)}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="bg-primary pointer-events-none absolute -right-12 -bottom-14 size-56 rounded-full opacity-25 blur-3xl"
        animate={drift(-35, -20)}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />

      <PressArea
        view={view}
        className="relative z-10 flex w-full flex-col items-center transition-transform active:scale-[0.98]"
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
          <p className="text-muted-foreground mt-2 text-sm font-semibold">
            {view.nextLabel ?? view.maxLabel}
          </p>
        )}
      </PressArea>

      {!view.pausedLabel && view.nextTierName ? (
        <div className="relative z-10 mt-5 h-2 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${view.tierColor}, var(--primary))` }}
            initial={{ width: 0 }}
            animate={{ width: `${view.progress * 100}%` }}
            transition={reduced ? { duration: 0 } : { duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      ) : null}
    </section>
  );
}

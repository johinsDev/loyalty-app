"use client";

import { motion } from "motion/react";

import { CountUp, PausedNotice, PressArea, TierIcon, usePrefersReducedMotion } from "./shared";
import type { PointsCardView } from "./types";

/** Template #8 — "Boleto": a loyalty ticket in the brand color — perforated
 *  stub for the tier, dashed tear line, progress printed along the bottom. */
export function TicketPointsCard({ view }: { view: PointsCardView }) {
  const reduced = usePrefersReducedMotion();

  return (
    <section className="relative">
      <motion.div
        className="from-primary to-primary/80 shadow-primary/30 relative flex overflow-hidden rounded-2xl bg-gradient-to-r text-white shadow-xl"
        whileTap={reduced ? undefined : { rotate: -1, scale: 0.99 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Main body */}
        <PressArea view={view} className="min-w-0 flex-1 p-6 text-left">
          <span className="text-xs font-bold tracking-widest text-white/70 uppercase">
            {view.tierName}
          </span>
          <div className="font-display mt-1 text-4xl font-semibold tracking-tight">
            <CountUp value={view.balance} format={view.formatBalance} />
            <span className="ml-1.5 text-base font-bold text-white/60">pts</span>
          </div>
          {view.pausedLabel ? (
            <PausedNotice view={view} light />
          ) : (
            <p className="mt-1.5 text-xs font-semibold text-white/80">
              {view.nextLabel ?? view.maxLabel}
            </p>
          )}
          {!view.pausedLabel && view.nextTierName ? (
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/20">
              <motion.div
                className="h-full rounded-full bg-white/90"
                initial={{ width: 0 }}
                animate={{ width: `${view.progress * 100}%` }}
                transition={reduced ? { duration: 0 } : { duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          ) : null}
        </PressArea>

        {/* Tear line + stub */}
        <div aria-hidden className="relative w-0 border-l-2 border-dashed border-white/40">
          <span className="bg-background absolute -top-2.5 -left-2.5 size-5 rounded-full" />
          <span className="bg-background absolute -bottom-2.5 -left-2.5 size-5 rounded-full" />
        </div>
        <div className="flex w-24 flex-none flex-col items-center justify-center gap-1.5 bg-black/10 p-3">
          <motion.span
            animate={reduced ? undefined : { rotate: [0, -8, 8, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.2, ease: "easeInOut" }}
          >
            <TierIcon iconKey={view.tierIconKey} className="size-7" style={{ color: view.tierColor }} />
          </motion.span>
          <span className="text-center text-[0.65rem] leading-tight font-extrabold tracking-wider text-white/80 uppercase">
            {view.tierName}
          </span>
        </div>
      </motion.div>
    </section>
  );
}

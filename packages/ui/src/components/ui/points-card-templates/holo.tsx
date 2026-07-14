"use client";

import { motion } from "motion/react";

import { CountUp, PausedNotice, PressArea, TierIcon, usePrefersReducedMotion } from "./shared";
import type { PointsCardView } from "./types";

/** Template #4 — "Holográfica": premium credit-card look with a holographic
 *  shine sweeping across in a slow loop and a subtle tilt on tap. */
export function HoloPointsCard({ view }: { view: PointsCardView }) {
  const reduced = usePrefersReducedMotion();

  return (
    <motion.section
      className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-black/30"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, var(--primary) 40%, #10131a) 0%, color-mix(in srgb, var(--primary) 14%, #0a0d13) 55%, ${view.tierColor}55 130%)`,
        aspectRatio: "1.586", // ISO card
      }}
      whileTap={reduced ? undefined : { rotateX: 6, rotateY: -6, scale: 0.99 }}
      transition={{ type: "spring", stiffness: 260, damping: 18 }}
    >
      {/* Holographic sweep */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 w-1/2 -skew-x-12"
        style={{
          background:
            "linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.14) 35%, rgba(140,255,220,0.18) 50%, rgba(190,140,255,0.16) 65%, transparent 100%)",
        }}
        initial={{ left: "-60%" }}
        animate={reduced ? undefined : { left: ["-60%", "120%"] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
      />

      <PressArea
        view={view}
        className="relative z-10 flex h-full w-full flex-col justify-between text-left"
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest text-white/70 uppercase">
            <TierIcon iconKey={view.tierIconKey} className="size-4" style={{ color: view.tierColor }} />
            {view.tierName}
          </span>
          {/* Chip */}
          <span aria-hidden className="h-6 w-8 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 opacity-80" />
        </div>

        <div>
          <div className="font-display text-4xl font-semibold tracking-tight">
            <CountUp value={view.balance} format={view.formatBalance} />
            <span className="ml-2 text-base font-bold text-white/50">pts</span>
          </div>
          {view.pausedLabel ? (
            <PausedNotice view={view} light />
          ) : (
            <p className="mt-1 text-xs font-semibold text-white/60">
              {view.nextLabel ?? view.maxLabel}
            </p>
          )}
          {!view.pausedLabel && view.nextTierName ? (
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
              <motion.div
                className="h-full rounded-full"
                style={{ background: view.tierColor }}
                initial={{ width: 0 }}
                animate={{ width: `${view.progress * 100}%` }}
                transition={reduced ? { duration: 0 } : { duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          ) : null}
        </div>
      </PressArea>
    </motion.section>
  );
}

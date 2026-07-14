"use client";

import { motion } from "motion/react";

import { balanceSizeClass, CountUp, PausedNotice, PressArea, TierIcon, usePrefersReducedMotion } from "./shared";
import type { PointsCardView } from "./types";

/** Template #9 — "Prisma": a slowly breathing mesh gradient of the brand and
 *  tier colors under a glass panel. */
export function MeshPointsCard({ view }: { view: PointsCardView }) {
  const reduced = usePrefersReducedMotion();
  const balanceLabel = view.formatBalance(view.balance);

  const mesh = `
    radial-gradient(at 20% 15%, var(--primary) 0%, transparent 55%),
    radial-gradient(at 85% 25%, ${view.tierColor} 0%, transparent 55%),
    radial-gradient(at 30% 90%, color-mix(in srgb, var(--primary) 60%, ${view.tierColor}) 0%, transparent 60%),
    radial-gradient(at 80% 80%, color-mix(in srgb, var(--primary) 45%, white) 0%, transparent 55%)`;

  return (
    <section className="relative overflow-hidden rounded-3xl text-white shadow-xl shadow-black/20">
      <motion.div
        aria-hidden
        className="absolute -inset-[30%]"
        style={{ backgroundImage: mesh, backgroundColor: "color-mix(in srgb, var(--primary) 55%, #171a21)" }}
        animate={reduced ? undefined : { rotate: [0, 10, -6, 0], scale: [1, 1.08, 1.02, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <div aria-hidden className="absolute inset-0 bg-black/15 backdrop-blur-2xl" />

      <PressArea
        view={view}
        className="relative z-10 flex w-full flex-col items-center p-7 transition-transform active:scale-[0.98]"
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-extrabold backdrop-blur-sm">
          <TierIcon iconKey={view.tierIconKey} className="size-3.5" />
          {view.tierName}
        </span>
        <span
          className={`font-display mt-4 font-semibold tracking-tight drop-shadow-sm ${balanceSizeClass(balanceLabel)}`}
        >
          <CountUp value={view.balance} format={view.formatBalance} />
        </span>
        {view.pausedLabel ? (
          <PausedNotice view={view} light />
        ) : (
          <p className="mt-2 text-sm font-semibold text-white/90">
            {view.nextLabel ?? view.maxLabel}
          </p>
        )}
        {!view.pausedLabel && view.nextTierName ? (
          <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-white/20">
            <motion.div
              className="h-full rounded-full bg-white/90"
              initial={{ width: 0 }}
              animate={{ width: `${view.progress * 100}%` }}
              transition={reduced ? { duration: 0 } : { duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        ) : null}
      </PressArea>
    </section>
  );
}

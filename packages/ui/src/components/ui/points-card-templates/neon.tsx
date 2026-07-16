"use client";

import { motion } from "motion/react";
import * as React from "react";

import { balanceSizeClass, CountUp, PausedNotice, PressArea, TierIcon, usePrefersReducedMotion } from "./shared";
import type { PointsCardView } from "./types";

const RING_CIRCUMFERENCE = 427; // r=68 → 2πr

/** Template #3 — "Neón nocturno": near-black card, a glowing neon progress
 *  ring in the tier color that softly pulses. */
export function NeonPointsCard({ view }: { view: PointsCardView }) {
  const reduced = usePrefersReducedMotion();
  const [filled, setFilled] = React.useState(false);
  React.useEffect(() => {
    if (reduced) {
      setFilled(true);
      return;
    }
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const ringOffset = RING_CIRCUMFERENCE * (1 - (filled ? view.progress : 0));
  const balanceLabel = view.formatBalance(view.balance);

  return (
    <section
      className="rounded-3xl p-7 text-white shadow-xl shadow-black/40 ring-1 ring-white/10"
      style={{ background: "color-mix(in srgb, var(--primary) 18%, #05060a)" }}
    >
      <PressArea
        view={view}
        className="flex w-full flex-col items-center transition-transform active:scale-[0.98]"
      >
        <motion.div
          className="relative grid size-44 place-items-center"
          animate={
            reduced
              ? undefined
              : { filter: ["brightness(1)", "brightness(1.25)", "brightness(1)"] }
          }
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          {/* overflow-visible: the neon drop-shadow must bleed past the svg
              box, or the glow clips into a visible square. */}
          <svg viewBox="0 0 160 160" className="absolute inset-0 size-full overflow-visible" aria-hidden>
            <circle cx="80" cy="80" r="68" fill="none" strokeWidth="10" className="stroke-white/10" />
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              stroke={view.tierColor}
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 80 80)"
              style={{
                filter: `drop-shadow(0 0 6px ${view.tierColor}) drop-shadow(0 0 14px ${view.tierColor})`,
                transition: reduced ? undefined : "stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)",
              }}
            />
          </svg>
          <div className="flex flex-col items-center">
            <span
              className={`font-display font-semibold tracking-tight ${balanceSizeClass(balanceLabel)}`}
              style={{ textShadow: `0 0 18px ${view.tierColor}66` }}
            >
              <CountUp value={view.balance} format={view.formatBalance} />
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-white/60">
              <TierIcon iconKey={view.tierIconKey} className="size-3.5" style={{ color: view.tierColor }} />
              {view.tierName}
            </span>
          </div>
        </motion.div>
        {view.pausedLabel ? (
          <PausedNotice view={view} light />
        ) : (
          <p className="mt-4 text-sm font-semibold" style={{ color: view.tierColor }}>
            {view.nextLabel ?? view.maxLabel}
          </p>
        )}
      </PressArea>
    </section>
  );
}

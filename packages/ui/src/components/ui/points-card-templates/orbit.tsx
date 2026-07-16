"use client";

import { motion } from "motion/react";
import * as React from "react";

import { balanceSizeClass, CountUp, PausedNotice, PressArea, TierIcon, usePrefersReducedMotion } from "./shared";
import type { PointsCardView } from "./types";

const RING_CIRCUMFERENCE = 427; // r=68 → 2πr

/** One satellite: a dot riding an invisible circle of the given radius. */
function Satellite({
  radius,
  size,
  duration,
  reverse,
  color,
  reduced,
}: {
  radius: number;
  size: number;
  duration: number;
  reverse?: boolean;
  color: string;
  reduced: boolean;
}) {
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-1/2"
      style={{ width: radius * 2, height: radius * 2, x: "-50%", y: "-50%" }}
      animate={reduced ? undefined : { rotate: reverse ? -360 : 360 }}
      transition={{ duration, repeat: Infinity, ease: "linear" }}
    >
      <span
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{ top: -size / 2, width: size, height: size, background: color }}
      />
    </motion.div>
  );
}

/** Template #7 — "Órbita": the balance is the sun; tier-colored satellites
 *  orbit it around a thin progress ring. */
export function OrbitPointsCard({ view }: { view: PointsCardView }) {
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
    <section className="from-primary/15 to-primary/5 rounded-3xl bg-gradient-to-b p-7 shadow-xl shadow-black/10">
      <PressArea
        view={view}
        className="flex w-full flex-col items-center transition-transform active:scale-[0.98]"
      >
        <div className="relative grid size-48 place-items-center">
          <svg viewBox="0 0 160 160" className="absolute inset-0 size-full" aria-hidden>
            <circle cx="80" cy="80" r="68" fill="none" strokeWidth="4" className="stroke-primary/15" />
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              strokeWidth="4"
              strokeLinecap="round"
              stroke="var(--primary)"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 80 80)"
              style={{
                transition: reduced ? undefined : "stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)",
              }}
            />
          </svg>
          <Satellite radius={82} size={11} duration={9} color={view.tierColor} reduced={reduced} />
          <Satellite radius={68} size={7} duration={14} reverse color="var(--primary)" reduced={reduced} />
          <Satellite radius={94} size={5} duration={20} color={`${view.tierColor}88`} reduced={reduced} />
          <div className="flex flex-col items-center">
            <span className={`font-display font-semibold tracking-tight ${balanceSizeClass(balanceLabel)}`}>
              <CountUp value={view.balance} format={view.formatBalance} />
            </span>
            <span className="text-muted-foreground -mt-0.5 inline-flex items-center gap-1 text-xs font-bold">
              <TierIcon iconKey={view.tierIconKey} className="size-3.5" style={{ color: view.tierColor }} />
              {view.tierName}
            </span>
          </div>
        </div>
        {view.pausedLabel ? (
          <PausedNotice view={view} />
        ) : (
          <p className="text-primary mt-3 text-sm font-semibold">
            {view.nextLabel ?? view.maxLabel}
          </p>
        )}
      </PressArea>
    </section>
  );
}

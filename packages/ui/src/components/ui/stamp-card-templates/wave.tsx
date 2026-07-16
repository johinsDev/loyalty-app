"use client";

import { motion } from "motion/react";

import {
  DefaultSpot,
  PendingProgress,
  StampGrid,
  StampsPausedNotice,
  usePrefersReducedMotion,
} from "./shared";
import type { StampCardView } from "./types";

const WAVE_PATH = "M0 20 Q 25 8 50 20 T 100 20 T 150 20 T 200 20 V 120 H 0 Z";

/** Template #6 — "Marea": a liquid brand-color tide rising with the cycle's
 *  progress, waves rolling sideways under the punch grid. */
export function WaveStampCard({ view }: { view: StampCardView }) {
  const reduced = usePrefersReducedMotion();
  const fill = view.pausedLabel ? 0.12 : 0.12 + (view.filledInCycle / view.goal) * 0.4;

  const wave = (opacity: number, duration: number, delay: number) => (
    <motion.div
      aria-hidden
      className="absolute bottom-0 left-0 w-[200%]"
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
      {wave(0.2, 7, 0)}
      {wave(0.35, 5, 0.6)}

      <div className="relative z-10 p-6">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-display text-foreground text-xl font-semibold tracking-tight">
            {view.title}
          </span>
          <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-extrabold whitespace-nowrap">
            {view.countLabel}
          </span>
        </div>
        <p
          className={`mb-4 text-sm font-semibold ${
            view.pausedLabel ? "text-muted-foreground/60" : "text-primary"
          }`}
        >
          {view.subtitle}
        </p>
        <StampGrid
          view={view}
          renderSpot={(spot) => <DefaultSpot view={view} spot={spot} />}
        />
        <StampsPausedNotice view={view} />
        <PendingProgress view={view} />
      </div>
    </section>
  );
}

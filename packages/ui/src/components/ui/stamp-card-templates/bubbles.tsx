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
 *  pearls drifting up behind the punch grid. */
export function BubblesStampCard({ view }: { view: StampCardView }) {
  const reduced = usePrefersReducedMotion();

  return (
    <section className="from-primary to-primary/70 shadow-primary/30 relative overflow-hidden rounded-3xl bg-gradient-to-b p-6 text-white shadow-xl">
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

      <div className="relative z-10">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-display text-xl font-semibold tracking-tight">
            {view.title}
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-extrabold whitespace-nowrap">
            {view.countLabel}
          </span>
        </div>
        <p
          className={`mb-4 text-sm font-semibold ${
            view.pausedLabel ? "text-white/45" : "text-white/85"
          }`}
        >
          {view.subtitle}
        </p>
        <StampGrid
          view={view}
          renderSpot={(spot) => (
            <DefaultSpot
              view={view}
              spot={spot}
              filledClassName="shadow-lg shadow-black/20 ring-2 ring-white/80"
              emptyClassName="border-white/40 bg-white/10 text-white/60"
            />
          )}
        />
        <StampsPausedNotice view={view} light />
        <PendingProgress view={view} light />
      </div>
    </section>
  );
}

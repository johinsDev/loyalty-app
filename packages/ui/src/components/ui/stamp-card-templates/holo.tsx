"use client";

import { motion } from "motion/react";

import {
  DefaultSpot,
  onColorOf,
  PendingProgress,
  StampGrid,
  StampsPausedNotice,
  usePrefersReducedMotion,
} from "./shared";
import type { StampCardView } from "./types";

/** Template #4 — "Holográfica": premium credit-card look with a holographic
 *  shine sweeping across the punch grid in a slow loop. */
export function HoloStampCard({ view }: { view: StampCardView }) {
  const reduced = usePrefersReducedMotion();
  const onColor = onColorOf(view);

  return (
    <section
      className="relative overflow-hidden rounded-3xl p-6 text-white shadow-xl shadow-black/30"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, var(--primary) 40%, #10131a) 0%, color-mix(in srgb, var(--primary) 14%, #0a0d13) 55%, color-mix(in srgb, ${onColor} 33%, transparent) 130%)`,
      }}
    >
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

      <div className="relative z-10">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-display text-xl font-semibold tracking-tight">
            {view.title}
          </span>
          <span
            aria-hidden
            className="h-6 w-8 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 opacity-80"
          />
        </div>
        <div className="mb-4 flex items-center justify-between gap-3">
          <p
            className={`text-sm font-semibold ${
              view.pausedLabel ? "text-white/40" : "text-white/70"
            }`}
          >
            {view.subtitle}
          </p>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold whitespace-nowrap backdrop-blur-sm">
            {view.countLabel}
          </span>
        </div>
        <StampGrid
          view={view}
          renderSpot={(spot) => (
            <DefaultSpot
              view={view}
              spot={spot}
              emptyClassName="border-white/25 bg-white/5 text-white/50"
            />
          )}
        />
        <StampsPausedNotice view={view} light />
        <PendingProgress view={view} light />
      </div>
    </section>
  );
}

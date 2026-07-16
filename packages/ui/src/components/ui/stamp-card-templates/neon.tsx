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

/** Template #3 — "Neón nocturno": near-black card, earned stamps glowing in
 *  the stamp color like neon tubes, the whole grid softly pulsing. */
export function NeonStampCard({ view }: { view: StampCardView }) {
  const reduced = usePrefersReducedMotion();
  const onColor = onColorOf(view);

  return (
    <section
      className="rounded-3xl p-6 text-white shadow-xl shadow-black/40 ring-1 ring-white/10"
      style={{ background: "color-mix(in srgb, var(--primary) 18%, #05060a)" }}
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-display text-xl font-semibold tracking-tight">
          {view.title}
        </span>
        <span
          className="rounded-full bg-white/10 px-3 py-1 text-xs font-extrabold whitespace-nowrap"
          style={{ color: onColor, textShadow: `0 0 12px ${onColor}` }}
        >
          {view.countLabel}
        </span>
      </div>
      <p
        className={`mb-4 text-sm font-semibold ${view.pausedLabel ? "text-white/40" : ""}`}
        style={view.pausedLabel ? undefined : { color: onColor }}
      >
        {view.subtitle}
      </p>
      <motion.div
        animate={
          reduced
            ? undefined
            : { filter: ["brightness(1)", "brightness(1.2)", "brightness(1)"] }
        }
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      >
        <StampGrid
          view={view}
          renderSpot={(spot) => (
            <div
              style={
                spot.kind === "filled"
                  ? {
                      filter: `drop-shadow(0 0 6px ${onColor}) drop-shadow(0 0 12px ${onColor})`,
                    }
                  : undefined
              }
            >
              <DefaultSpot
                view={view}
                spot={spot}
                emptyClassName="border-white/20 bg-white/5 text-white/45"
              />
            </div>
          )}
        />
      </motion.div>
      <StampsPausedNotice view={view} light />
      <PendingProgress view={view} light />
    </section>
  );
}

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

/** Template #9 — "Prisma": a slowly breathing mesh gradient of the brand and
 *  stamp colors under a glass panel. */
export function MeshStampCard({ view }: { view: StampCardView }) {
  const reduced = usePrefersReducedMotion();
  const onColor = onColorOf(view);

  const mesh = `
    radial-gradient(at 20% 15%, var(--primary) 0%, transparent 55%),
    radial-gradient(at 85% 25%, ${onColor} 0%, transparent 55%),
    radial-gradient(at 30% 90%, color-mix(in srgb, var(--primary) 60%, ${onColor}) 0%, transparent 60%),
    radial-gradient(at 80% 80%, color-mix(in srgb, var(--primary) 45%, white) 0%, transparent 55%)`;

  return (
    <section className="relative overflow-hidden rounded-3xl text-white shadow-xl shadow-black/20">
      <motion.div
        aria-hidden
        className="absolute -inset-[30%]"
        style={{
          backgroundImage: mesh,
          backgroundColor: "color-mix(in srgb, var(--primary) 55%, #171a21)",
        }}
        animate={reduced ? undefined : { rotate: [0, 10, -6, 0], scale: [1, 1.08, 1.02, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: "easeInOut" }}
      />
      <div aria-hidden className="absolute inset-0 bg-black/15 backdrop-blur-2xl" />

      <div className="relative z-10 p-6">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="font-display text-xl font-semibold tracking-tight drop-shadow-sm">
            {view.title}
          </span>
          <span className="rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-extrabold whitespace-nowrap backdrop-blur-sm">
            {view.countLabel}
          </span>
        </div>
        <p
          className={`mb-4 text-sm font-semibold ${
            view.pausedLabel ? "text-white/45" : "text-white/90"
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
              filledClassName="ring-1 ring-white/40"
              emptyClassName="border-white/30 bg-white/10 text-white/55"
            />
          )}
        />
        <StampsPausedNotice view={view} light />
        <PendingProgress view={view} light />
      </div>
    </section>
  );
}

"use client";

import * as React from "react";

import {
  DefaultSpot,
  PendingProgress,
  StampGrid,
  usePrefersReducedMotion,
} from "./shared";
import type { StampCardView } from "./types";

/** Template #1 — the original design: card surface, title + count pill header,
 *  staggered zoom-in spots, dashed empties in the brand tint. */
export function ClassicStampCard({ view }: { view: StampCardView }) {
  const reduced = usePrefersReducedMotion();

  return (
    <section className="bg-card rounded-3xl p-6 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
      <style>{`@keyframes t4StampIn{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}`}</style>
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
          view.pausedLabel ? "text-muted-foreground" : "text-primary"
        }`}
      >
        {view.pausedLabel ?? view.subtitle}
      </p>
      <StampGrid
        view={view}
        renderSpot={(spot) => (
          <div
            style={
              reduced
                ? undefined
                : {
                    animation: "t4StampIn 0.45s ease-out backwards",
                    animationDelay: `${(spot.index - 1) * 45}ms`,
                  }
            }
          >
            <DefaultSpot view={view} spot={spot} />
          </div>
        )}
      />
      <PendingProgress view={view} />
    </section>
  );
}

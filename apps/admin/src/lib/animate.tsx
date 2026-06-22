"use client";

import type { CSSProperties } from "react";

import { useReducedMotion } from "./use-reduced-motion";

type FadeUpOptions = { step?: number; duration?: number; base?: number };

/**
 * Staggered fade-up entrance (the customer-app motion, ported for the cashier).
 * `const fade = useFadeUp()` then `style={fade(i)}` on each list/grid item.
 * Respects reduced motion; relies on the global `tw-fade-up` keyframe.
 */
export function useFadeUp(options: FadeUpOptions = {}) {
  const reduced = useReducedMotion();
  const { step = 60, duration = 0.5, base = 40 } = options;
  return (index: number): CSSProperties | undefined =>
    reduced
      ? undefined
      : {
          animation: `tw-fade-up ${duration}s ease-out backwards`,
          animationDelay: `${base + index * step}ms`,
        };
}

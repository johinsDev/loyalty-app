"use client";

import type { CSSProperties, ReactNode } from "react";

import { useReducedMotion } from "./use-reduced-motion";

type FadeUpOptions = {
  /** Delay between consecutive items, ms (default 60). */
  step?: number;
  /** Animation duration, seconds (default 0.45). */
  duration?: number;
  /** Delay added before the first item, ms (default 0). */
  base?: number;
};

/**
 * Staggered fade-up entrance — the motion the history list uses, made reusable.
 * Returns a style factory: spread `style={fade(i)}` on each item in a list/grid
 * and they animate in one after another. Respects reduced motion (renders in
 * place) and relies on the global `tw-fade-up` keyframe (globals.css).
 *
 *   const fade = useFadeUp();
 *   items.map((it, i) => <Card key={it.id} style={fade(i)} />)
 */
export function useFadeUp(options: FadeUpOptions = {}) {
  const reduced = useReducedMotion();
  const { step = 60, duration = 0.45, base = 0 } = options;
  return (index: number): CSSProperties | undefined =>
    reduced
      ? undefined
      : {
          animation: `tw-fade-up ${duration}s ease-out backwards`,
          animationDelay: `${base + index * step}ms`,
        };
}

/**
 * Wrapper variant of {@link useFadeUp} for section-level reveals where adding a
 * wrapping element is fine (it would break a grid, so use the hook there). Works
 * inside server components — only this boundary is client.
 */
export function FadeUp({
  index = 0,
  className,
  children,
  ...options
}: FadeUpOptions & {
  index?: number;
  className?: string;
  children: ReactNode;
}) {
  const fade = useFadeUp(options);
  return (
    <div className={className} style={fade(index)}>
      {children}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "./use-reduced-motion";

type Props = {
  /** Final value to count up to. */
  value: number;
  /** Render a leading "+" (for deltas like "+38"). */
  plus?: boolean;
  /** Animation length in ms. */
  duration?: number;
  /** Delay before the count starts, in ms. */
  delay?: number;
  /** Format each frame (e.g. a locale-aware / compact formatter). Defaults to
   *  `toLocaleString("es")`. */
  format?: (value: number) => string;
  className?: string;
};

// easeOutCubic — fast start, gentle landing, like a chart drawing in.
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts a number up from zero to `value` on mount using requestAnimationFrame.
 * Skips straight to the final value when the user prefers reduced motion. Used
 * by the points ring, the Historial month summary, and the receipt sheet.
 */
export function CountUp({
  value,
  plus = false,
  duration = 1100,
  delay = 0,
  format,
  className,
}: Props) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(reduced ? value : 0);
  const frame = useRef<number | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (reduced) {
      setDisplay(value);
      return;
    }

    let start: number | undefined;
    const step = (now: number) => {
      start ??= now;
      const progress = Math.min((now - start) / duration, 1);
      setDisplay(Math.round(ease(progress) * value));
      if (progress < 1) frame.current = requestAnimationFrame(step);
    };

    timer.current = setTimeout(() => {
      frame.current = requestAnimationFrame(step);
    }, delay);

    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, duration, delay, reduced]);

  return (
    <span className={className}>
      {plus ? "+" : ""}
      {format ? format(display) : display.toLocaleString("es")}
    </span>
  );
}

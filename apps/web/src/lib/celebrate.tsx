"use client";

import { useEffect, useState } from "react";

import { useReducedMotion } from "./use-reduced-motion";

const COLORS = ["#1BAD9D", "#5fe0c8", "#000323", "#ffd36e", "#ff8fa3", "#8ad9ff"];

type Props = {
  /** Number of confetti pieces. */
  count?: number;
  /** How far pieces fall, in px. */
  distance?: number;
  /** Fired once the burst finishes (or immediately under reduced motion). */
  onDone?: () => void;
};

/**
 * A one-shot confetti burst, generalized from the onboarding success screen.
 * Mount it conditionally over a `relative` parent; it renders the pieces once,
 * then calls `onDone` so the parent can unmount it. No-op (and instant `onDone`)
 * when the user prefers reduced motion. Reused for stamp-earned / streak wins.
 */
export function Celebrate({ count = 28, distance = 520, onDone }: Props) {
  const reduced = useReducedMotion();
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => {
      const w = 7 + Math.random() * 7;
      return {
        left: Math.random() * 100,
        delay: Math.random() * 0.4,
        dur: 1.8 + Math.random() * 1.3,
        w,
        h: w * (1 + Math.random()),
        rot: Math.random() * 360,
        color: COLORS[i % COLORS.length],
      };
    }),
  );

  useEffect(() => {
    if (reduced) {
      onDone?.();
      return;
    }
    const longest = Math.max(...pieces.map((p) => p.delay + p.dur));
    const id = setTimeout(() => onDone?.(), longest * 1000 + 100);
    return () => clearTimeout(id);
  }, [reduced, pieces, onDone]);

  if (reduced) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
      aria-hidden
    >
      <style>{`@keyframes t4Celebrate{to{transform:translateY(${distance}px) rotate(720deg);opacity:0}}`}</style>
      {pieces.map((p) => (
        <div
          key={`${p.left}-${p.dur}-${p.rot}`}
          style={{
            position: "absolute",
            top: "-24px",
            left: `${p.left}%`,
            width: `${p.w}px`,
            height: `${p.h}px`,
            background: p.color,
            borderRadius: "2px",
            transform: `rotate(${p.rot}deg)`,
            animation: `t4Celebrate ${p.dur}s ${p.delay}s cubic-bezier(.3,.6,.5,1) forwards`,
          }}
        />
      ))}
    </div>
  );
}

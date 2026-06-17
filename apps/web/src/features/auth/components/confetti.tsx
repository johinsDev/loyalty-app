"use client";

import { useState } from "react";

const COLORS = ["#1BAD9D", "#5fe0c8", "#000323", "#ffd36e", "#ff8fa3", "#8ad9ff"];

/**
 * Lightweight CSS confetti for the success screen (from the onboarding design).
 * Pieces are generated once on the client — this only mounts after a client
 * interaction (OTP verified), so it never renders on the server.
 */
export function Confetti() {
  const [pieces] = useState(() =>
    Array.from({ length: 28 }, (_, i) => {
      const w = 7 + Math.random() * 7;
      return {
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 2.1 + Math.random() * 1.4,
        w,
        h: w * (1 + Math.random()),
        rot: Math.random() * 360,
        color: COLORS[i % COLORS.length],
      };
    }),
  );

  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <style>{`@keyframes t4ConfettiFall{to{transform:translateY(940px) rotate(720deg)}}`}</style>
      {pieces.map((p) => (
        <div
          key={`${p.left}-${p.dur}-${p.rot}`}
          style={{
            position: "absolute",
            top: "-30px",
            left: `${p.left}%`,
            width: `${p.w}px`,
            height: `${p.h}px`,
            background: p.color,
            borderRadius: "2px",
            transform: `rotate(${p.rot}deg)`,
            animation: `t4ConfettiFall ${p.dur}s ${p.delay}s cubic-bezier(.3,.6,.5,1) forwards`,
          }}
        />
      ))}
    </div>
  );
}

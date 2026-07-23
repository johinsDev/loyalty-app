"use client";

import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

type Props = {
  /** Caption shown under the corner-bracket frame. */
  caption?: string;
  /** Copy for the camera-permission / no-camera error state. */
  permissionError: string;
  /** Fires once with the decoded QR text; the scanner stops before calling. */
  onResult: (text: string) => void;
};

/**
 * Live camera QR scanner — a `<video>` framed by the corner-bracket overlay
 * (same look as the old decorative `ScanFrame`). Decodes continuously with
 * `@zxing/browser`; on the first result it stops the stream and hands the raw
 * text up. Cleans up the camera on unmount.
 */
export function QrScanner({ caption, permissionError, onResult }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const firedRef = useRef(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    const start = async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result) => {
            if (!result || firedRef.current) return;
            firedRef.current = true;
            controlsRef.current?.stop();
            onResult(result.getText());
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch {
        if (!cancelled) setError(true);
      }
    };

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [onResult]);

  if (error) {
    return (
      <div className="my-5 flex h-52 items-center justify-center rounded-3xl bg-rose-500/10 px-6 text-center text-sm font-bold text-rose-500">
        {permissionError}
      </div>
    );
  }

  return (
    <div
      className="relative my-5 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-3xl"
      style={{ background: "#0a1626" }}
    >
      <video ref={videoRef} muted playsInline className="absolute inset-0 size-full object-cover" />
      {/* Brand glow behind the frame. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 60%)",
        }}
      />
      <div className="relative aspect-square w-[58%]">
        {[
          "top-0 left-0 rounded-tl-lg border-t-4 border-l-4",
          "top-0 right-0 rounded-tr-lg border-t-4 border-r-4",
          "bottom-0 left-0 rounded-bl-lg border-b-4 border-l-4",
          "bottom-0 right-0 rounded-br-lg border-b-4 border-r-4",
        ].map((c) => (
          <span key={c} className={`border-primary absolute size-8 ${c}`} />
        ))}
        {/* Sweeping scan line. */}
        <motion.div
          aria-hidden
          className="absolute inset-x-[8%] h-[3px] rounded-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, var(--primary), transparent)",
            boxShadow: "0 0 12px 1px color-mix(in srgb, var(--primary) 60%, transparent)",
          }}
          initial={{ top: "10%" }}
          animate={{ top: ["10%", "88%", "10%"] }}
          transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity }}
        />
      </div>
      {caption ? (
        <div className="absolute inset-x-0 bottom-4 text-center text-sm font-semibold text-white/80">
          {caption}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import {
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { AnimatePresence, motion } from "motion/react";
import { Flame } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Celebrate } from "@/lib/celebrate";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const DAYS = 5; // visual streak length (matches the v1 goal)

/** A mini streak row — `lit` days glowing. */
function MiniStreak({ lit }: { lit: number }) {
  return (
    <div className="from-primary to-primary/80 w-full rounded-3xl bg-gradient-to-br p-5 text-white shadow-xl">
      <div className="grid grid-cols-5 gap-2.5">
        {Array.from({ length: DAYS }).map((_, i) => (
          <span
            key={i}
            className={`grid aspect-square place-items-center rounded-2xl ${
              i < lit
                ? "bg-gradient-to-br from-orange-300 to-rose-400 text-white shadow-md shadow-orange-400/40"
                : "bg-white/15 text-white/40"
            }`}
          >
            <Flame className="size-4" />
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * "Pro" streak-reward-claimed celebration: confetti the moment it opens, then
 * the completed streak flips into a fresh one. Opened by the realtime listener
 * after the cashier confirms the claim.
 */
export function StreakClaimCelebration({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Home");
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<"claimed" | "fresh">("claimed");
  const [confetti, setConfetti] = useState(false);

  useEffect(() => {
    if (!open) {
      setPhase("claimed");
      setConfetti(false);
      return;
    }
    const toConfetti = window.setTimeout(() => setConfetti(true), 150);
    const toFresh = window.setTimeout(() => setPhase("fresh"), 1600);
    return () => {
      window.clearTimeout(toConfetti);
      window.clearTimeout(toFresh);
    };
  }, [open]);

  const fresh = phase === "fresh";

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent
        mobileClassName="mx-auto w-full max-w-sm"
        showCloseButton={false}
      >
        {confetti ? (
          <div className="pointer-events-none fixed inset-0 z-[60]">
            <Celebrate distance={1100} count={40} />
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-4 px-6 pt-4 pb-6 text-center">
          <span className="text-5xl">🔥</span>
          <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
            {fresh ? t("streakNewTitle") : t("streakClaimedTitle")}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-muted-foreground text-sm">
            {fresh ? t("streakNewBody") : t("streakClaimedBody")}
          </ResponsiveModalDescription>

          <div className="w-full" style={{ perspective: 1000 }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={fresh ? "new" : "old"}
                initial={
                  reduced ? { opacity: 0 } : { opacity: 0, rotateY: -90, scale: 0.92 }
                }
                animate={
                  reduced ? { opacity: 1 } : { opacity: 1, rotateY: 0, scale: 1 }
                }
                exit={
                  reduced ? { opacity: 0 } : { opacity: 0, rotateY: 90, scale: 0.92 }
                }
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <MiniStreak lit={fresh ? 0 : DAYS} />
              </motion.div>
            </AnimatePresence>
          </div>

          <Button
            onClick={onClose}
            disabled={!fresh}
            className="mt-1 h-12 w-full rounded-2xl font-semibold"
          >
            {t("streakDone")}
          </Button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

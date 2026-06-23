"use client";

import {
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { AnimatePresence, motion } from "motion/react";
import { CupSoda, Gift } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Celebrate } from "@/lib/celebrate";
import { useReducedMotion } from "@/lib/use-reduced-motion";

const SPOTS = 10; // 9 stamps + the free reward (last spot)

/** A mini stamp card for the celebration animation. `filled` stamps lit. */
function MiniCard({ filled }: { filled: number }) {
  return (
    <div className="from-primary to-primary/80 w-full rounded-3xl bg-gradient-to-br p-5 text-white shadow-xl">
      <div className="grid grid-cols-5 gap-2.5">
        {Array.from({ length: SPOTS }).map((_, i) => {
          const n = i + 1;
          const isReward = n === SPOTS;
          const isFilled = n <= filled;
          return (
            <span
              key={n}
              className={`grid aspect-square place-items-center rounded-full ${
                isReward
                  ? "bg-gradient-to-br from-amber-300 to-amber-400 text-white shadow-md shadow-amber-400/40"
                  : isFilled
                    ? "bg-white text-primary"
                    : "bg-white/15 text-white/40"
              }`}
            >
              {isReward ? <Gift className="size-4" /> : <CupSoda className="size-4" />}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * "Pro" reward-claimed celebration: confetti, then the full card flips away and
 * a fresh empty card flips in (the new wallet), with a "Listo" button. Opened by
 * the realtime listener after the cashier confirms the claim.
 */
export function ClaimCelebration({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Card");
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<"claimed" | "fresh">("claimed");
  const [confetti, setConfetti] = useState(false);

  // Confetti rains the moment the modal opens; the full (old) card holds briefly,
  // then flips into the fresh card.
  useEffect(() => {
    if (!open) {
      setPhase("claimed");
      setConfetti(false);
      return;
    }
    // Let the modal paint, then rain the confetti on open.
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
          <span className="text-5xl">{fresh ? "🧋" : "🎉"}</span>
          <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
            {fresh ? t("newCardTitle") : t("claimedTitle")}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-muted-foreground text-sm">
            {fresh ? t("newCardBody") : t("claimedBody")}
          </ResponsiveModalDescription>

          <div className="w-full" style={{ perspective: 1000 }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={fresh ? "new" : "old"}
                initial={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, rotateY: -90, scale: 0.92 }
                }
                animate={
                  reduced
                    ? { opacity: 1 }
                    : { opacity: 1, rotateY: 0, scale: 1 }
                }
                exit={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, rotateY: 90, scale: 0.92 }
                }
                transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                style={{ transformStyle: "preserve-3d" }}
              >
                <MiniCard filled={fresh ? 0 : SPOTS - 1} />
              </motion.div>
            </AnimatePresence>
          </div>

          <Button
            onClick={onClose}
            disabled={!fresh}
            className="mt-1 h-12 w-full rounded-2xl font-semibold"
          >
            {t("done")}
          </Button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

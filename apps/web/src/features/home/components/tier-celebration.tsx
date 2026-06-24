"use client";

import {
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { motion } from "motion/react";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { Celebrate } from "@/lib/celebrate";
import { useReducedMotion } from "@/lib/use-reduced-motion";

export interface CelebratedTier {
  name: string;
  color: string;
  benefits: string[];
  terms: string | null;
}

/**
 * Level-up celebration: confetti + the new tier (color), its benefits and T&C.
 * Opened by the realtime listener on a `tier.changed` (direction "up"); the tier
 * details ride on the event so there's no refetch race.
 */
export function TierCelebration({
  tier,
  onClose,
}: {
  tier: CelebratedTier | null;
  onClose: () => void;
}) {
  const t = useTranslations("Home");
  const reduced = useReducedMotion();
  const open = tier !== null;

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-sm" showCloseButton={false}>
        {open ? (
          <div className="pointer-events-none fixed inset-0 z-[60]">
            <Celebrate distance={1100} count={44} />
          </div>
        ) : null}

        <div className="flex flex-col items-center gap-4 px-6 pt-5 pb-6 text-center">
          <motion.span
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotate: -12 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="grid size-20 place-items-center rounded-3xl text-white shadow-xl"
            style={{ backgroundColor: tier?.color ?? "#888" }}
          >
            <Sparkles className="size-10" />
          </motion.span>

          <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
            {t("tierUpTitle", { tier: tier?.name ?? "" })}
          </ResponsiveModalTitle>
          <ResponsiveModalDescription className="text-muted-foreground text-sm">
            {t("tierUpSubtitle")}
          </ResponsiveModalDescription>

          {tier && tier.benefits.length > 0 ? (
            <div
              className="w-full rounded-2xl p-4 text-left"
              style={{ backgroundColor: `${tier.color}1A` }}
            >
              <p className="mb-2 text-xs font-bold tracking-wider" style={{ color: tier.color }}>
                {t("tierBenefitsHeading")}
              </p>
              <ul className="space-y-1">
                {tier.benefits.map((b) => (
                  <li key={b} className="text-foreground text-sm font-semibold">
                    • {b}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {tier?.terms ? (
            <p className="text-muted-foreground text-[0.6875rem] leading-relaxed">
              {tier.terms}
            </p>
          ) : null}

          <Button onClick={onClose} className="mt-1 h-12 w-full rounded-2xl font-semibold">
            {t("tierUpCta")}
          </Button>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

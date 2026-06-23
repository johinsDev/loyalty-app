"use client";

import { useQuery } from "@tanstack/react-query";
import { Flame, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { useTRPC } from "@/lib/trpc/client";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Dismissible in-app banner shown when the customer completed a streak and has a
 * reward to claim. "Reclamar" opens the QR drawer in streak mode; the ✕
 * dismisses for the session. Reads the same `myStreak` query the card uses
 * (React Query dedupes). Collapses out (height + fade) when claimed so the
 * celebration that follows doesn't jump.
 */
export function StreakRewardBanner() {
  const t = useTranslations("Home");
  const trpc = useTRPC();
  const openClaim = useQrDrawer((s) => s.openClaim);
  const reduced = useReducedMotion();
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery(trpc.streaks.myStreak.queryOptions());
  const show = !dismissed && Boolean(data?.rewardPending);

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          key="streak-reward-banner"
          layout
          initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, height: "auto" }}
          exit={
            reduced
              ? { opacity: 0 }
              : { opacity: 0, height: 0, marginTop: 0, scale: 0.97 }
          }
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden"
        >
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 p-4 text-white shadow-md shadow-orange-500/30">
            <span className="grid size-10 flex-none place-items-center rounded-full bg-white/25">
              <Flame className="size-5" />
            </span>
            <p className="min-w-0 flex-1 text-sm font-bold">
              {t("streakBannerText")}
            </p>
            <button
              type="button"
              onClick={() => openClaim("streak")}
              className="flex-none rounded-full bg-neutral-900 px-4 py-2 text-xs font-extrabold text-white"
            >
              {t("rewardBannerCta")}
            </button>
            <button
              type="button"
              aria-label={t("dismiss")}
              onClick={() => setDismissed(true)}
              className="grid size-7 flex-none place-items-center rounded-full text-white/70 hover:bg-white/20"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

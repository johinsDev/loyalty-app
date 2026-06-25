"use client";

import { useQuery } from "@tanstack/react-query";
import { Gift, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import type { RewardListItem } from "@/features/rewards/types";
import { useTRPC } from "@/lib/trpc/client";
import { useReducedMotion } from "@/lib/use-reduced-motion";

/**
 * Dismissible in-app banner for the STAMP-CARD-COMPLETION free drink only — the
 * "bebida gratis" you earn by filling your wallet. It shows when the stamp
 * wallet is complete (`currentStamps >= stampsGoal`) AND that full-card free
 * drink is actually claimable (a stamps-only ready reward whose `stampsRequired`
 * equals the wallet goal — seeded as "Bebida gratis"). Arbitrary ready rewards
 * (toppings/upgrades) live on /recompensas and never trigger this banner.
 * "Reclamar" opens the unified QR drawer pre-selected to that reward; the ✕
 * dismisses it for the session.
 */
export function RewardReadyBanner() {
  const t = useTranslations("Home");
  const trpc = useTRPC();
  const reduced = useReducedMotion();
  const openClaim = useQrDrawer((s) => s.openClaim);
  const [dismissed, setDismissed] = useState(false);

  const { data: wallet } = useQuery(trpc.stamps.myWallet.queryOptions());
  const { data: ready } = useQuery(
    trpc.rewards.list.queryOptions({ filter: "listos", limit: 20 }),
  );

  // The full-card free drink: a stamps-only ready reward whose stamps cost is
  // exactly the wallet goal. Only meaningful once the card is actually complete.
  const walletComplete =
    wallet != null &&
    wallet.stampsGoal > 0 &&
    wallet.currentStamps >= wallet.stampsGoal;

  const freeDrink: RewardListItem | null =
    walletComplete && ready
      ? (ready.items.find(
          (r) =>
            r.pointsCost == null &&
            r.stampsRequired != null &&
            r.stampsRequired === wallet.stampsGoal,
        ) ?? null)
      : null;

  const show = !dismissed && freeDrink !== null;

  return (
    <AnimatePresence initial={false}>
      {show && freeDrink ? (
        <motion.div
          key="reward-banner"
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
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-400 p-4 text-amber-950 shadow-md shadow-amber-400/30">
            <span className="grid size-10 flex-none place-items-center rounded-full bg-white/30">
              <Gift className="size-5" />
            </span>
            <p className="min-w-0 flex-1 text-sm font-bold">
              {t("rewardBannerText")}
            </p>
            <button
              type="button"
              onClick={() =>
                openClaim({
                  kind: "reward",
                  rewardId: freeDrink.id,
                  currency: "stamps",
                })
              }
              className="flex-none rounded-full bg-neutral-900 px-4 py-2 text-xs font-extrabold text-white"
            >
              {t("rewardBannerCta")}
            </button>
            <button
              type="button"
              aria-label={t("dismiss")}
              onClick={() => setDismissed(true)}
              className="grid size-7 flex-none place-items-center rounded-full text-amber-950/60 hover:bg-white/30"
            >
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

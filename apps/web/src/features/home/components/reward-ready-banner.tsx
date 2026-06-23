"use client";

import { useQuery } from "@tanstack/react-query";
import { Gift, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Dismissible in-app banner shown on entry when the BE says the customer has a
 * completed wallet (a reward to claim). "Reclamar" opens the QR drawer; the ✕
 * dismisses it for the session. Reads the same `myWallet` query the card uses
 * (React Query dedupes by key), so no extra request.
 */
export function RewardReadyBanner() {
  const t = useTranslations("Home");
  const trpc = useTRPC();
  const setQrOpen = useQrDrawer((s) => s.setOpen);
  const [dismissed, setDismissed] = useState(false);

  const { data } = useQuery(trpc.stamps.myWallet.queryOptions());
  if (dismissed || !data?.rewardPending) return null;

  return (
    <div className="mt-5 flex items-center gap-3 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-400 p-4 text-amber-950 shadow-md shadow-amber-400/30">
      <span className="grid size-10 flex-none place-items-center rounded-full bg-white/30">
        <Gift className="size-5" />
      </span>
      <p className="min-w-0 flex-1 text-sm font-bold">{t("rewardBannerText")}</p>
      <button
        type="button"
        onClick={() => setQrOpen(true)}
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
  );
}

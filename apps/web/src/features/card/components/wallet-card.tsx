"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Gift, Stamp } from "lucide-react";
import { useTranslations } from "next-intl";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { useTRPC } from "@/lib/trpc/client";

/**
 * The live wallet — its own island so it streams in (and updates on realtime)
 * independently of the history / completed sections. Reads the prefetched
 * `myWallet` query with `useSuspenseQuery`; the parent `<Suspense>` shows
 * `<WalletCardSkeleton />` until the streamed promise resolves.
 */
export function WalletCard() {
  const t = useTranslations("Card");
  const trpc = useTRPC();
  const setQrOpen = useQrDrawer((s) => s.setOpen);

  const { data: w } = useSuspenseQuery(trpc.sellos.myWallet.queryOptions());
  const remaining = Math.max(0, w.walletSize - w.currentStamps);

  return (
    <section className="from-primary to-primary/80 rounded-3xl bg-gradient-to-br p-6 text-white shadow-lg">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">{t("title")}</h1>
        <span className="text-sm font-bold opacity-90">
          {w.currentStamps}/{w.walletSize}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-5 gap-2.5">
        {Array.from({ length: w.walletSize }).map((_, i) => (
          <span
            key={i}
            className={`grid aspect-square place-items-center rounded-full ${
              i < w.currentStamps ? "bg-white text-primary" : "bg-white/15 text-white/40"
            }`}
          >
            <Stamp className="size-4" />
          </span>
        ))}
      </div>

      {w.rewardPending ? (
        <button
          type="button"
          onClick={() => setQrOpen(true)}
          className="text-primary mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-extrabold"
        >
          <Gift className="size-4" />
          {t("claim")}
        </button>
      ) : (
        <p className="mt-4 text-sm font-semibold text-white/85">
          {t("toGo", { remaining })}
        </p>
      )}
    </section>
  );
}

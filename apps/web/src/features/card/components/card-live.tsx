"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { Check, Gift, Stamp } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { useTRPC } from "@/lib/trpc/client";

/**
 * The live loyalty card. Reads the prefetched queries with `useSuspenseQuery`
 * (data is always present — the parent `<Suspense>` shows `<CardSkeleton />`
 * while the streamed promises resolve). The realtime `stamp.earned` /
 * `reward.claimed` listener invalidates these queries so the stamps, history and
 * completed wallets update without a reload.
 */
export function CardLive() {
  const t = useTranslations("Card");
  const format = useFormatter();
  const trpc = useTRPC();
  const setQrOpen = useQrDrawer((s) => s.setOpen);

  const { data: w } = useSuspenseQuery(trpc.sellos.myWallet.queryOptions());
  const { data: history } = useSuspenseQuery(
    trpc.sellos.myHistory.queryOptions({ page: 1, pageSize: 20 }),
  );
  const { data: completed } = useSuspenseQuery(
    trpc.sellos.myCompletedWallets.queryOptions(),
  );

  const remaining = Math.max(0, w.walletSize - w.currentStamps);

  return (
    <div className="space-y-4">
      {/* Wallet */}
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

      {/* Completed wallets */}
      {completed.length > 0 ? (
        <section className="bg-card border-border rounded-3xl border p-5 shadow-sm">
          <h2 className="font-display text-base font-semibold tracking-tight">
            {t("completedTitle")}
          </h2>
          <ul className="mt-3 space-y-2">
            {completed.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2 font-semibold">
                  <Check className="size-4 text-emerald-600" />
                  {t("walletLabel", { n: c.sequence })}
                </span>
                <span className="text-muted-foreground font-medium">
                  {c.status === "claimed" ? t("claimed") : t("pending")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Purchase history */}
      <section className="bg-card border-border rounded-3xl border p-5 shadow-sm">
        <h2 className="font-display text-base font-semibold tracking-tight">
          {t("historyTitle")}
        </h2>
        {history.rows.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-sm">
            {t("emptyHistory")}
          </p>
        ) : (
          <ul className="divide-border mt-2 divide-y">
            {history.rows.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm font-semibold">
                    {format.dateTime(p.createdAt, { dateStyle: "medium" })}
                  </p>
                  <p className="text-muted-foreground text-xs font-medium">
                    {format.number(p.priceCents / 100, {
                      style: "currency",
                      currency: "COP",
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
                <span className="text-primary text-sm font-extrabold">
                  {t("purchaseStamp", { stamps: p.stamps })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CupSoda, Gift } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { useTRPC } from "@/lib/trpc/client";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type Selected =
  | { kind: "filled"; n: number }
  | { kind: "empty"; n: number }
  | { kind: "reward" };

/**
 * Stamp wallet — a 5×2 grid where every Nth stamp is a free drink. Reads the
 * customer's real wallet (`stamps.myWallet`) + history (`stamps.myHistory`) via
 * `useSuspenseQuery` (the parent `<Suspense>` shows `<StampsCardSkeleton />`; the
 * realtime listener invalidates both so a new stamp pops in live). Tapping a
 * filled stamp reveals the real purchase that earned it; an empty one shows how
 * many are left; the reward stamp opens the QR drawer to claim when the card is
 * full, else shows the prize.
 */
export function StampsCard() {
  const t = useTranslations("Home");
  const format = useFormatter();
  const trpc = useTRPC();
  const setQrOpen = useQrDrawer((s) => s.setOpen);
  const reduced = useReducedMotion();
  const [selected, setSelected] = useState<Selected | null>(null);

  const { data: w } = useSuspenseQuery(trpc.stamps.myWallet.queryOptions());
  const { data: history } = useSuspenseQuery(
    trpc.stamps.myHistory.queryOptions({ page: 1, pageSize: 20 }),
  );

  const filled = w.currentStamps;
  const total = w.walletSize;
  const remaining = Math.max(0, total - filled);
  const stamps = Array.from({ length: total }, (_, i) => i + 1);

  // The purchases that filled THIS wallet, oldest → newest, so position i maps
  // to stamp #i. (myHistory is newest-first across all wallets.)
  const walletPurchases = history.rows
    .filter((r) => r.walletSequence === w.sequence)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const money = (cents: number) =>
    format.number(cents / 100, {
      style: "currency",
      currency: "COP",
      maximumFractionDigits: 0,
    });

  const enter = (i: number) =>
    reduced
      ? undefined
      : ({
          animation: "tw-zoom-in 0.45s ease-out backwards",
          animationDelay: `${i * 45}ms`,
        } as const);

  const onStampClick = (n: number, isReward: boolean, isFilled: boolean) => {
    if (isReward) {
      if (w.rewardPending) setQrOpen(true);
      else setSelected({ kind: "reward" });
      return;
    }
    setSelected(isFilled ? { kind: "filled", n } : { kind: "empty", n });
  };

  return (
    <section className="bg-card rounded-3xl p-6 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
      <style>{`@keyframes tw-zoom-in{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:scale(1)}}@keyframes t4StampGlow{0%,100%{box-shadow:0 6px 14px -4px rgba(251,191,36,.5)}50%{box-shadow:0 8px 22px 0 rgba(251,191,36,.85)}}`}</style>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="font-display text-foreground text-xl font-semibold tracking-tight">
          {t("stampsTitle")}
        </span>
        <span className="bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-extrabold whitespace-nowrap">
          {t("stampsCount", { filled, total })}
        </span>
      </div>
      <p className="text-primary mb-4 text-sm font-semibold">
        {w.rewardPending ? t("rewardReady") : t("stampsRemaining", { count: remaining })}
      </p>
      <div className="grid grid-cols-5 gap-3">
        {stamps.map((n) => {
          const isReward = n === total;
          const isFilled = n <= filled;
          const isLatest = n === filled;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onStampClick(n, isReward, isFilled)}
              aria-label={
                isReward
                  ? t("stampRewardTitle")
                  : isFilled
                    ? t("stampFilledTitle")
                    : t("stampEmptyTitle")
              }
              style={enter(n - 1)}
              className={`grid aspect-square place-items-center rounded-full text-xs font-bold transition-transform active:scale-90 ${
                isReward
                  ? "bg-gradient-to-br from-amber-300 to-amber-400 text-white shadow-md shadow-amber-400/40"
                  : isFilled
                    ? "bg-primary text-white shadow-md shadow-primary/40"
                    : "border-primary/30 bg-primary/5 text-primary/50 border-2 border-dashed"
              }`}
            >
              <span
                style={
                  isReward && !reduced
                    ? { animation: "t4StampGlow 2.4s ease-in-out infinite" }
                    : undefined
                }
                className={`grid size-full place-items-center rounded-full ${
                  isLatest && !isReward && !reduced
                    ? "motion-safe:animate-in motion-safe:zoom-in-50"
                    : ""
                }`}
              >
                {isReward ? (
                  <Gift className="size-5" />
                ) : isFilled ? (
                  <CupSoda className="size-5" />
                ) : (
                  n
                )}
              </span>
            </button>
          );
        })}
      </div>

      <ResponsiveModal
        open={selected !== null}
        onOpenChange={(next) => !next && setSelected(null)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <StampDetail
            selected={selected}
            total={total}
            purchase={
              selected?.kind === "filled" ? walletPurchases[selected.n - 1] : undefined
            }
            money={money}
            formatDate={(d) => format.dateTime(d, { dateStyle: "medium" })}
          />
        </ResponsiveModalContent>
      </ResponsiveModal>
    </section>
  );
}

function StampDetail({
  selected,
  total,
  purchase,
  money,
  formatDate,
}: {
  selected: Selected | null;
  total: number;
  purchase: { priceCents: number; createdAt: Date } | undefined;
  money: (cents: number) => string;
  formatDate: (d: Date) => string;
}) {
  const t = useTranslations("Home");
  if (!selected) return null;

  if (selected.kind === "reward") {
    return (
      <>
        <ResponsiveModalHeader className="text-left">
          <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
            {t("stampRewardTitle")}
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="px-4 pb-6">
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-amber-300 to-amber-400 p-5 text-white shadow-md shadow-amber-400/40">
            <Gift className="size-9 flex-none" />
            <p className="text-sm font-semibold">{t("stampDetailReward")}</p>
          </div>
        </div>
      </>
    );
  }

  if (selected.kind === "empty") {
    return (
      <>
        <ResponsiveModalHeader className="text-left">
          <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
            {t("stampEmptyTitle")}
          </ResponsiveModalTitle>
        </ResponsiveModalHeader>
        <div className="px-4 pb-6">
          <div className="text-muted-foreground border-primary/30 bg-primary/5 rounded-2xl border-2 border-dashed p-5 text-sm font-semibold">
            {t("stampDetailEmpty", { count: total - selected.n + 1 })}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <ResponsiveModalHeader className="text-left">
        <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
          {t("stampFilledTitle")}
        </ResponsiveModalTitle>
        {purchase ? (
          <ResponsiveModalDescription>
            {formatDate(purchase.createdAt)}
          </ResponsiveModalDescription>
        ) : null}
      </ResponsiveModalHeader>
      <div className="px-4 pb-6">
        <div className="bg-card flex items-center gap-4 rounded-2xl p-4 ring-1 ring-black/5 dark:ring-white/10">
          <span className="from-primary/10 to-primary/5 grid size-14 flex-none place-items-center rounded-2xl bg-gradient-to-br text-2xl">
            🧋
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-foreground text-base font-bold">
              {t("stampFilledTitle")}
            </span>
            {purchase ? (
              <span className="bg-primary/10 text-primary inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-extrabold">
                {money(purchase.priceCents)} · +1 🧋
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import {
  PointsCardTemplate,
  type PointsCardView,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  TiltCard,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Gift, ShoppingBag, Sparkles, Wallet } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState, type ComponentType } from "react";

import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

import { PointsCardSkeleton } from "./points-card-skeleton";

const TX_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  purchase: ShoppingBag,
  reward: Gift,
  adjust: Sparkles,
  other: Wallet,
};

/** Friendly inline label for a point transaction (no raw reason parsing). */
function txLabel(
  e: { kind: string; rewardName: string | null },
  t: (key: string, values?: Record<string, string>) => string,
): string {
  switch (e.kind) {
    case "purchase":
      return t("txPurchase");
    case "reward":
      return e.rewardName
        ? t("txRedeem", { reward: e.rewardName })
        : t("txRedeemGeneric");
    case "adjust":
      return t("txAdjust");
    default:
      return t("txOther");
  }
}

/**
 * Points wallet — a progress ring around the spendable balance, the current
 * tier badge (color from config), and a tier-to-tier bar. Reads the real
 * summary (`points.mySummary`) with a client `useQuery` (per-user + the
 * cross-origin Worker can't auth an SSR fetch); the realtime listener
 * invalidates it so the ring animates live on earn / level-up. Tap → recent
 * point activity + the current tier's benefits.
 */
export function PointsCard() {
  const t = useTranslations("Home");
  const format = useFormatter();
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const { data: s } = useQuery(trpc.points.mySummary.queryOptions());
  // Which visual template the org picked (public, cached; falls back to
  // classic while loading so the card never flashes a different design).
  const { data: loyalty } = useQuery(trpc.settings.loyaltyConfig.queryOptions());

  if (!s) return <PointsCardSkeleton />;
  // Points paused (org runs stamps-only): nothing to earn. With a balance the
  // card stays in a redeem-only state; with none there's nothing to show.
  if (s.paused && s.balance === 0) return null;

  // Keep the balance legible: compact, locale-aware notation for big numbers
  // (es "13,9 mil" / en "13.9K").
  const formatPoints = (n: number) =>
    s.balance >= 10_000
      ? format.number(n, { notation: "compact", maximumFractionDigits: 1 })
      : format.number(n);

  const view: PointsCardView = {
    balance: s.balance,
    formatBalance: formatPoints,
    tierName: s.current.name,
    tierColor: s.current.color,
    tierIconKey: s.current.icon,
    progress: s.progress,
    nextTierName: s.next?.name ?? null,
    nextThreshold: s.next?.threshold ?? null,
    nextLabel: s.next
      ? t("toNextTier", { points: s.remainingToNext, tier: s.next.name })
      : null,
    maxLabel: t("tierMax"),
    pausedLabel: s.paused ? t("pointsPaused") : null,
    detailAriaLabel: t("pointsDetailAria"),
    onPress: () => setOpen(true),
  };

  return (
    <>
      <TiltCard>
        <PointsCardTemplate template={loyalty?.pointsCardTemplate ?? "classic"} view={view} />
      </TiltCard>
      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <PointsDetail
            tierName={s.current.name}
            tierColor={s.current.color}
            balance={s.balance}
            benefits={s.current.benefits.map((b) => b.label)}
            onClose={() => setOpen(false)}
          />
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

function PointsDetail({
  tierName,
  tierColor,
  balance,
  benefits,
  onClose,
}: {
  tierName: string;
  tierColor: string;
  balance: number;
  benefits: string[];
  onClose: () => void;
}) {
  const t = useTranslations("Home");
  const format = useFormatter();
  const trpc = useTRPC();
  const { data: history } = useQuery(
    trpc.points.myTransactions.queryOptions({ limit: 20 }),
  );

  return (
    <>
      <ResponsiveModalHeader className="text-left">
        <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
          {t("pointsDetailTitle")}
        </ResponsiveModalTitle>
        <ResponsiveModalDescription>
          {t("pointsDetailSubtitle", { points: balance })}
        </ResponsiveModalDescription>
      </ResponsiveModalHeader>

      <div className="space-y-4 px-4">
        {benefits.length ? (
          <div className="rounded-2xl p-4" style={{ backgroundColor: `${tierColor}1A` }}>
            <p className="mb-2 text-xs font-bold tracking-wider" style={{ color: tierColor }}>
              {t("tierBenefitsTitle", { tier: tierName })}
            </p>
            <ul className="space-y-1">
              {benefits.map((b) => (
                <li key={b} className="text-foreground text-sm font-semibold">
                  • {b}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="-mr-2 flex max-h-72 min-h-0 flex-col gap-2 overflow-y-auto pr-2">
          {history && history.items.length > 0 ? (
            history.items.map((e) => {
              const Icon = TX_ICONS[e.kind] ?? Wallet;
              const negative = e.points < 0;
              return (
                <div
                  key={e.id}
                  className="bg-card flex items-center gap-3 rounded-2xl p-3 ring-1 ring-black/5 dark:ring-white/10"
                >
                  <span className="from-primary/10 to-primary/5 grid size-11 flex-none place-items-center rounded-xl bg-gradient-to-br">
                    <Icon className="text-primary size-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-foreground truncate text-sm font-bold">
                      {txLabel(e, t)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {format.dateTime(e.createdAt, { dateStyle: "medium" })}
                    </span>
                  </div>
                  <span
                    className={`inline-flex flex-none items-center rounded-full px-3 py-1 text-xs font-extrabold ${
                      negative
                        ? "bg-red-500/10 text-red-600 dark:text-red-400"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {e.points > 0 ? `+${e.points}` : e.points}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="text-muted-foreground text-sm">{t("pointsNoActivity")}</p>
          )}
        </div>
      </div>

      <div className="p-4">
        <Link
          href="/points/history"
          onClick={onClose}
          className="bg-primary/10 text-primary flex items-center justify-center gap-1.5 rounded-full py-3 text-sm font-bold"
        >
          {t("seeAllPoints")}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </>
  );
}

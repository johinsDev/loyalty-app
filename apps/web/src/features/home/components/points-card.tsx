import { getTranslations } from "next-intl/server";

import { pointsWallet } from "../data";

/**
 * Points wallet — a progress ring around the balance, the current tier, and a
 * tier-to-tier progress bar. One of the two wallet models the home showcases
 * (the other is {@link StampsCard}); the live wallet/ledger feature will pick
 * which one an org uses.
 */
export async function PointsCard() {
  const t = await getTranslations("Home");
  const {
    points,
    tier,
    tierIcon: TierIcon,
    toNextReward,
    ringCircumference,
    ringOffset,
    nextTier,
    tierProgress,
  } = pointsWallet;
  const NextIcon = nextTier.icon;

  return (
    <section className="from-primary/5 to-primary/20 rounded-3xl bg-gradient-to-br p-6 shadow-xl shadow-primary/15">
      <div className="flex flex-col items-center">
        <div className="relative grid size-40 place-items-center">
          <svg
            viewBox="0 0 160 160"
            className="absolute inset-0 size-full"
            aria-hidden
          >
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              className="stroke-white/70"
              strokeWidth="13"
            />
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              className="stroke-primary"
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 80 80)"
            />
          </svg>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-muted-foreground text-xs font-bold tracking-wider">
              {t("pointsLabel")}
            </span>
            <span className="font-display text-foreground text-5xl leading-none font-semibold tracking-tight">
              {points}
            </span>
            <span className="bg-card text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap shadow-sm">
              <TierIcon className="size-3.5" />
              {t("tierBadge", { tier })}
            </span>
          </div>
        </div>
        <p className="text-primary mt-3.5 mb-4 text-sm font-semibold">
          {t("toNextReward", { points: toNextReward })}
        </p>
      </div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-bold whitespace-nowrap">
        <span className="text-foreground inline-flex items-center gap-1">
          <TierIcon className="text-primary size-3.5" />
          {tier}
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1">
          <NextIcon className="size-3.5" />
          {nextTier.name} · {nextTier.at}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/60">
        <div
          className="from-primary to-primary/40 h-full rounded-full bg-gradient-to-r"
          style={{ width: `${tierProgress * 100}%` }}
        />
      </div>
    </section>
  );
}

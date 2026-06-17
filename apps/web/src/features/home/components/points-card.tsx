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
    <section className="rounded-[30px] bg-gradient-to-br from-[#eafff8] to-[#d6f6ed] p-6 shadow-[0_20px_44px_-22px_rgba(27,173,157,.5)]">
      <div className="flex flex-col items-center">
        <div className="relative grid size-40 place-items-center">
          <svg
            width="160"
            height="160"
            viewBox="0 0 160 160"
            className="absolute inset-0"
            aria-hidden
          >
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              stroke="rgba(255,255,255,.7)"
              strokeWidth="13"
            />
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              stroke="var(--primary)"
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 80 80)"
            />
          </svg>
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-muted-foreground text-[11px] font-bold tracking-[1.5px]">
              {t("pointsLabel")}
            </span>
            <span className="font-display text-[46px] leading-none font-semibold tracking-tight text-foreground">
              {points}
            </span>
            <span className="bg-card text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap shadow-[0_4px_10px_-6px_rgba(0,3,35,.2)]">
              <TierIcon className="size-3.5" />
              {t("tierBadge", { tier })}
            </span>
          </div>
        </div>
        <p className="mt-3.5 mb-4 text-sm font-semibold text-[#3f7d72]">
          {t("toNextReward", { points: toNextReward })}
        </p>
      </div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-bold whitespace-nowrap">
        <span className="inline-flex items-center gap-1 text-foreground">
          <TierIcon className="text-primary size-3.5" />
          {tier}
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1">
          <NextIcon className="size-3.5" />
          {nextTier.name} · {nextTier.at}
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-white/70">
        <div
          className="from-primary h-full rounded-full bg-gradient-to-r to-[#7fd8c8]"
          style={{ width: `${tierProgress * 100}%` }}
        />
      </div>
    </section>
  );
}

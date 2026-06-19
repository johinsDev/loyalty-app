"use client";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@loyalty/ui";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { CountUp } from "@/lib/count-up";
import { Link } from "@/i18n/navigation";
import { useReducedMotion } from "@/lib/use-reduced-motion";

import { pointsActivity, pointsWallet } from "../data";

/**
 * Points wallet — a progress ring around the balance, the current tier, and a
 * tier-to-tier progress bar. The balance counts up from zero and the ring fills
 * in on mount (chart-style); tapping the ring opens a drawer with the recent
 * point-earning activity and a link to the full history. Client component so it
 * can animate and respond to taps. One of the two wallet models the home
 * showcases (the other is {@link StampsCard}).
 */
export function PointsCard() {
  const t = useTranslations("Home");
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
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);

  // Ring + level bar start empty, then fill toward their targets after mount.
  const [filled, setFilled] = useState(reduced);
  useEffect(() => {
    if (reduced) {
      setFilled(true);
      return;
    }
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  return (
    <section className="from-primary/5 to-primary/20 shadow-primary/15 rounded-3xl bg-gradient-to-br p-7 shadow-xl">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("pointsDetailAria")}
        className="flex w-full flex-col items-center transition-transform active:scale-[0.98]"
      >
        <div className="relative grid size-44 place-items-center">
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
              strokeDashoffset={filled ? ringOffset : ringCircumference}
              transform="rotate(-90 80 80)"
              style={
                reduced
                  ? undefined
                  : {
                      transition:
                        "stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)",
                    }
              }
            />
          </svg>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-muted-foreground text-xs font-bold tracking-wider">
              {t("pointsLabel")}
            </span>
            <CountUp
              value={points}
              className="font-display text-foreground text-5xl leading-none font-semibold tracking-tight"
            />
            <span className="bg-card text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap shadow-sm">
              <TierIcon className="size-3.5" />
              {t("tierBadge", { tier })}
            </span>
          </div>
        </div>
        <p className="text-primary mt-4 mb-5 text-sm font-semibold">
          {t("toNextReward", { points: toNextReward })}
        </p>
      </button>
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
          style={{
            width: `${(filled ? tierProgress : 0) * 100}%`,
            transition: reduced
              ? undefined
              : "width 1.1s cubic-bezier(.22,1,.36,1)",
          }}
        />
      </div>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="mx-auto w-full max-w-md lg:max-w-lg">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-display text-2xl font-semibold tracking-tight">
              {t("pointsDetailTitle")}
            </DrawerTitle>
            <DrawerDescription>
              {t("pointsDetailSubtitle", { points })}
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-2 px-4">
            {pointsActivity.map((e) => (
              <div
                key={e.id}
                className="bg-card flex items-center gap-3 rounded-2xl p-3 ring-1 ring-black/5 dark:ring-white/10"
              >
                <span className="from-primary/10 to-primary/5 grid size-11 flex-none place-items-center rounded-xl bg-gradient-to-br text-xl">
                  {e.emoji}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-foreground truncate text-sm font-bold">
                    {e.label}
                  </span>
                  <span className="text-muted-foreground text-xs">{e.meta}</span>
                </div>
                <span className="bg-primary/10 text-primary inline-flex flex-none items-center rounded-full px-3 py-1 text-xs font-extrabold">
                  +{e.points}
                </span>
              </div>
            ))}
          </div>
          <div className="p-4">
            <Link
              href="/history"
              onClick={() => setOpen(false)}
              className="bg-primary/10 text-primary flex items-center justify-center gap-1.5 rounded-full py-3 text-sm font-bold"
            >
              {t("seeAllHistory")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </DrawerContent>
      </Drawer>
    </section>
  );
}

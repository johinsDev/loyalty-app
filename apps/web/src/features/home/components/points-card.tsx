"use client";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Crown, Flower2, Leaf, Sparkles } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useState, type ComponentType } from "react";

import { Link } from "@/i18n/navigation";
import { CountUp } from "@/lib/count-up";
import { useTRPC } from "@/lib/trpc/client";
import { useReducedMotion } from "@/lib/use-reduced-motion";

import { PointsCardSkeleton } from "./points-card-skeleton";

const RING_CIRCUMFERENCE = 427; // r=68 → 2πr

const TIER_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  leaf: Leaf,
  flower: Flower2,
  crown: Crown,
};
const tierIcon = (key: string) => TIER_ICONS[key] ?? Sparkles;

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
  const trpc = useTRPC();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);

  const { data: s } = useQuery(trpc.points.mySummary.queryOptions());

  // Ring + bar start empty, then fill toward their targets after mount.
  const [filled, setFilled] = useState(reduced);
  useEffect(() => {
    if (reduced) {
      setFilled(true);
      return;
    }
    const id = requestAnimationFrame(() => setFilled(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  if (!s) return <PointsCardSkeleton />;

  const TierIcon = tierIcon(s.current.icon);
  const NextIcon = s.next ? tierIcon(s.next.icon) : Crown;
  const ringOffset = RING_CIRCUMFERENCE * (1 - (filled ? s.progress : 0));

  return (
    <section className="from-primary/5 to-primary/20 shadow-primary/15 rounded-3xl bg-gradient-to-br p-7 shadow-xl">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("pointsDetailAria")}
        className="flex w-full flex-col items-center transition-transform active:scale-[0.98]"
      >
        <div className="relative grid size-44 place-items-center">
          <svg viewBox="0 0 160 160" className="absolute inset-0 size-full" aria-hidden>
            <circle cx="80" cy="80" r="68" fill="none" className="stroke-white/70" strokeWidth="13" />
            <circle
              cx="80"
              cy="80"
              r="68"
              fill="none"
              stroke={s.current.color}
              strokeWidth="13"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 80 80)"
              style={
                reduced
                  ? undefined
                  : { transition: "stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)" }
              }
            />
          </svg>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-muted-foreground text-xs font-bold tracking-wider">
              {t("pointsLabel")}
            </span>
            <CountUp
              value={s.balance}
              className="font-display text-foreground text-5xl leading-none font-semibold tracking-tight"
            />
            <span
              className="bg-card inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap shadow-sm"
              style={{ color: s.current.color }}
            >
              <TierIcon className="size-3.5" />
              {t("tierBadge", { tier: s.current.name })}
            </span>
          </div>
        </div>
        <p className="text-primary mt-4 mb-5 text-sm font-semibold">
          {s.next
            ? t("toNextTier", { points: s.remainingToNext, tier: s.next.name })
            : t("tierMax")}
        </p>
      </button>

      {s.next ? (
        <>
          <div className="mb-1.5 flex items-center justify-between text-xs font-bold whitespace-nowrap">
            <span className="text-foreground inline-flex items-center gap-1">
              <TierIcon className="size-3.5" style={{ color: s.current.color }} />
              {s.current.name}
            </span>
            <span className="text-muted-foreground inline-flex items-center gap-1">
              <NextIcon className="size-3.5" />
              {s.next.name} · {s.next.threshold}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/60">
            <div
              className="from-primary to-primary/40 h-full rounded-full bg-gradient-to-r"
              style={{
                width: `${(filled ? s.progress : 0) * 100}%`,
                transition: reduced ? undefined : "width 1.1s cubic-bezier(.22,1,.36,1)",
              }}
            />
          </div>
        </>
      ) : null}

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
    </section>
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
    trpc.points.myHistory.queryOptions({ page: 1, pageSize: 20 }),
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

        <div className="flex flex-col gap-2">
          {history && history.rows.length > 0 ? (
            history.rows.map((e) => (
              <div
                key={e.id}
                className="bg-card flex items-center gap-3 rounded-2xl p-3 ring-1 ring-black/5 dark:ring-white/10"
              >
                <span className="from-primary/10 to-primary/5 grid size-11 flex-none place-items-center rounded-xl bg-gradient-to-br text-xl">
                  🧋
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-foreground truncate text-sm font-bold">
                    {e.reason ?? t("pointsEarnReason")}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {format.dateTime(e.createdAt, { dateStyle: "medium" })}
                  </span>
                </div>
                <span className="bg-primary/10 text-primary inline-flex flex-none items-center rounded-full px-3 py-1 text-xs font-extrabold">
                  {e.points > 0 ? `+${e.points}` : e.points}
                </span>
              </div>
            ))
          ) : (
            <p className="text-muted-foreground text-sm">{t("pointsNoActivity")}</p>
          )}
        </div>
      </div>

      <div className="p-4">
        <Link
          href="/history"
          onClick={onClose}
          className="bg-primary/10 text-primary flex items-center justify-center gap-1.5 rounded-full py-3 text-sm font-bold"
        >
          {t("seeAllHistory")}
          <ArrowRight className="size-4" />
        </Link>
      </div>
    </>
  );
}

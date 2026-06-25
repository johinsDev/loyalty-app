"use client";

import {
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { Check, Flame, Minus } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { useQrDrawer } from "@/features/qr/hooks/use-qr-drawer";
import { useTRPC } from "@/lib/trpc/client";
import { useReducedMotion } from "@/lib/use-reduced-motion";

import { StreakCardSkeleton } from "./streak-card-skeleton";

type DayState = "done" | "closed" | "missed" | "today" | "future";

/**
 * Purchase streak — consecutive OPEN days with a purchase. Reads the customer's
 * real streak (`streaks.myStreak`) with a client `useQuery` (per-user + the
 * cross-origin Worker can't authenticate an SSR fetch), shows a skeleton while
 * loading, and the realtime listener invalidates it so a day lights up live.
 * The week strip shows the current week (closed days are skipped, not breaks).
 * Tapping opens a detail with the streak history + the claim CTA when a reward
 * is pending.
 */
export function StreakCard() {
  const t = useTranslations("Home");
  const trpc = useTRPC();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const labels = t("weekDays").split(",");

  const { data: s } = useQuery(trpc.streaks.myStreak.queryOptions());
  if (!s) return <StreakCardSkeleton />;

  const remaining = Math.max(0, s.goalDays - s.currentCount);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-card w-full rounded-3xl p-5 text-left shadow-lg shadow-black/5 ring-1 ring-black/5 transition-transform active:scale-[0.99] dark:ring-white/10"
      >
        <style>{`@keyframes t4FlamePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}@keyframes t4StreakIn{from{opacity:0;transform:translateY(10px) scale(.85)}to{opacity:1;transform:none}}`}</style>
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-12 flex-none place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-md shadow-orange-500/30">
            <Flame className="size-6" />
          </span>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="font-display text-foreground text-2xl font-semibold tracking-tight">
              {t("streakDays", { days: s.currentCount })}
            </span>
            <span className="text-muted-foreground truncate text-sm">
              {s.rewardPending
                ? t("streakRewardReady")
                : remaining === 0
                  ? t("streakSub")
                  : t("streakRemaining", { count: remaining })}
            </span>
          </div>
        </div>

        <div className="flex justify-between gap-1.5">
          {s.week.map((day, i) => (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-2">
              <DayCell state={day.state} index={i} reduced={reduced} />
              <span
                className={`text-xs font-bold ${
                  day.state === "today" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {labels[i]}
              </span>
            </div>
          ))}
        </div>
      </button>

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <StreakDetail
            currentCount={s.currentCount}
            goalDays={s.goalDays}
            rewardPending={s.rewardPending}
          />
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

function DayCell({
  state,
  index,
  reduced,
}: {
  state: DayState;
  index: number;
  reduced: boolean;
}) {
  const base =
    "grid aspect-square w-full max-w-11 place-items-center rounded-2xl text-sm font-bold";
  // Staggered drop-in on mount (left→right), like the stamp grid.
  const enter = reduced
    ? undefined
    : ({
        animation: "t4StreakIn 0.4s ease-out backwards",
        animationDelay: `${index * 60}ms`,
      } as const);

  if (state === "done") {
    return (
      <span
        style={enter}
        className={`${base} bg-primary text-white shadow-sm shadow-primary/30`}
      >
        <Check className="size-4" />
      </span>
    );
  }
  if (state === "today") {
    return (
      <span
        style={enter}
        className={`${base} border-primary text-primary border-2 border-dashed`}
      >
        <Flame
          className="size-4"
          style={
            reduced
              ? undefined
              : { animation: "t4FlamePulse 1.8s ease-in-out infinite" }
          }
        />
      </span>
    );
  }
  if (state === "closed") {
    return (
      <span style={enter} className={`${base} bg-muted/60 text-muted-foreground/50`}>
        <Minus className="size-4" />
      </span>
    );
  }
  // missed | future — empty cell, missed reads slightly stronger.
  return (
    <span
      style={enter}
      className={`${base} ${state === "missed" ? "bg-muted text-muted-foreground/40" : "bg-muted/40"}`}
    />
  );
}

function StreakDetail({
  currentCount,
  goalDays,
  rewardPending,
}: {
  currentCount: number;
  goalDays: number;
  rewardPending: boolean;
}) {
  const t = useTranslations("Home");
  const format = useFormatter();
  const trpc = useTRPC();
  const openClaim = useQrDrawer((s) => s.openClaim);
  const { data: history } = useQuery(trpc.streaks.myHistory.queryOptions());

  const claimNow = () => {
    (document.activeElement as HTMLElement | null)?.blur();
    openClaim({ kind: "streak" });
  };

  return (
    <>
      <ResponsiveModalHeader className="text-left">
        <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
          {t("streakDetailTitle")}
        </ResponsiveModalTitle>
        <ResponsiveModalDescription>
          {rewardPending
            ? t("streakRewardReady")
            : t("streakRemaining", { count: Math.max(0, goalDays - currentCount) })}
        </ResponsiveModalDescription>
      </ResponsiveModalHeader>

      <div className="space-y-5 px-4 pb-6">
        <div className="bg-muted/40 flex items-center gap-3 rounded-2xl p-4">
          <span className="grid size-10 flex-none place-items-center rounded-full bg-gradient-to-br from-orange-400 to-rose-500 text-white">
            <Flame className="size-5" />
          </span>
          <p className="text-sm font-semibold">
            {t("streakDays", { days: currentCount })} ·{" "}
            {t("streakGoalOf", { goal: goalDays })}
          </p>
        </div>

        {rewardPending ? (
          <Button onClick={claimNow} className="h-12 w-full rounded-2xl font-semibold">
            {t("streakClaimCta")}
          </Button>
        ) : null}

        <div>
          <p className="text-muted-foreground mb-2 text-xs font-bold tracking-wider">
            {t("streakHistoryTitle")}
          </p>
          {history && history.length > 0 ? (
            <ul className="space-y-2">
              {history.map((h) => (
                <li
                  key={h.id}
                  className="bg-card flex items-center justify-between rounded-2xl p-3 ring-1 ring-black/5 dark:ring-white/10"
                >
                  <span className="text-sm font-semibold">
                    {t("streakWalletLabel", { n: h.sequence })}
                  </span>
                  <span className="text-muted-foreground text-xs font-bold">
                    {h.status === "claimed" ? t("streakClaimed") : t("streakPending")}
                    {h.completedAt
                      ? ` · ${format.dateTime(h.completedAt, { dateStyle: "medium" })}`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-sm">{t("streakNoHistory")}</p>
          )}
        </div>
      </div>
    </>
  );
}

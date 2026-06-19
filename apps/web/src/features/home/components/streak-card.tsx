"use client";

import { Check, Flame } from "lucide-react";
import { useTranslations } from "next-intl";

import { useReducedMotion } from "@/lib/use-reduced-motion";

import { streak } from "../data";

const DOW = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * Purchase streak — consecutive days with a purchase, with an even week strip
 * (one cell per day, today highlighted). The day cells drop in left→right on
 * mount and today's flame pulses, so the streak reads as something living you
 * don't want to break. Client component (entrance + pulse animations).
 * Hardcoded sample (see `../data`) until the wallet/ledger feature drives it.
 */
export function StreakCard() {
  const t = useTranslations("Home");
  const labels = t("weekDays").split(",");
  const reduced = useReducedMotion();

  return (
    <section className="bg-card rounded-3xl p-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
      <style>{`@keyframes t4StreakIn{from{opacity:0;transform:translateY(10px) scale(.85)}to{opacity:1;transform:none}}@keyframes t4FlamePulse{0%,100%{transform:scale(1)}50%{transform:scale(1.12)}}`}</style>
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-12 flex-none place-items-center rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-md shadow-orange-500/30">
          <Flame className="size-6" />
        </span>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-foreground text-2xl font-semibold tracking-tight">
            {t("streakDays", { days: streak.days })}
          </span>
          <span className="text-muted-foreground text-sm">
            {t("streakSub")}
          </span>
        </div>
      </div>

      <div className="flex justify-between gap-1.5">
        {streak.week.map((bought, i) => {
          const isToday = i === streak.todayIndex;
          return (
            <div
              key={DOW[i]}
              className="flex flex-1 flex-col items-center gap-2"
            >
              <span
                style={
                  reduced
                    ? undefined
                    : {
                        animation: "t4StreakIn 0.4s ease-out backwards",
                        animationDelay: `${i * 60}ms`,
                      }
                }
                className={`grid aspect-square w-full max-w-11 place-items-center rounded-2xl text-sm font-bold ${
                  bought
                    ? "bg-primary text-white shadow-sm shadow-primary/30"
                    : isToday
                      ? "border-primary text-primary border-2 border-dashed"
                      : "bg-muted text-muted-foreground/60"
                }`}
              >
                {bought ? (
                  <Check className="size-4" />
                ) : isToday ? (
                  <Flame
                    className="size-4"
                    style={
                      reduced
                        ? undefined
                        : { animation: "t4FlamePulse 1.8s ease-in-out infinite" }
                    }
                  />
                ) : null}
              </span>
              <span
                className={`text-xs font-bold ${
                  isToday ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

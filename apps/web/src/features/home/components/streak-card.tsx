import { Check, Flame } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { streak } from "../data";

const DOW = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * Purchase streak — consecutive days with a purchase, with an even week strip
 * (one cell per day, today highlighted). Hardcoded sample (see `../data`) until
 * the wallet/ledger feature drives it.
 */
export async function StreakCard() {
  const t = await getTranslations("Home");
  const labels = t("weekDays").split(",");

  return (
    <section className="bg-card rounded-3xl p-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
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
                  <Flame className="size-4" />
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

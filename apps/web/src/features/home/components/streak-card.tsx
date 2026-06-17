import { Check, Flame } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { streak } from "../data";

const DOW = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

/**
 * Purchase streak — consecutive days with a purchase, with a per-day week strip.
 * Hardcoded sample (see `../data`) until the wallet/ledger feature drives it.
 */
export async function StreakCard() {
  const t = await getTranslations("Home");
  const labels = t("weekDays").split(",");

  return (
    <section className="bg-card rounded-3xl p-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-12 flex-none place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-amber-400 text-white shadow-md shadow-amber-400/40">
          <Flame className="size-6" />
        </span>
        <div className="flex flex-col">
          <span className="text-muted-foreground text-xs font-bold tracking-wider">
            {t("streakTitle")}
          </span>
          <span className="font-display text-foreground text-xl font-semibold tracking-tight">
            {t("streakDays", { days: streak.days })}
          </span>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        {streak.week.map((bought, i) => {
          const isToday = i === streak.todayIndex;
          return (
            <div key={DOW[i]} className="flex flex-col items-center gap-1.5">
              <span
                className={`grid size-9 place-items-center rounded-full ${
                  bought
                    ? "bg-primary text-white"
                    : "bg-muted text-muted-foreground"
                } ${
                  isToday
                    ? "ring-primary ring-offset-card ring-2 ring-offset-2"
                    : ""
                }`}
              >
                {bought ? <Check className="size-4" /> : null}
              </span>
              <span className="text-muted-foreground text-xs font-semibold">
                {labels[i]}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground text-sm">{t("streakSub")}</p>
    </section>
  );
}

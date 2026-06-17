import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { stampsBalance, tier } from "../data";

/**
 * Level standing — a mint hero card showing the current tier, the next one, a
 * progress bar toward it, and the benefits that unlock there. On desktop it
 * rides along as a sticky aside next to the catalog (see {@link Rewards}).
 */
export async function TierCard() {
  const t = await getTranslations("Rewards");
  const pct = Math.min(100, Math.round((stampsBalance / tier.next.at) * 100));

  return (
    <section className="from-primary/15 to-primary/5 ring-primary/15 rounded-[1.75rem] bg-gradient-to-br p-6 shadow-lg shadow-primary/10 ring-1">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="font-display text-foreground text-xl font-semibold tracking-tight">
          {tier.current.emoji} {t("tierTitle", { name: tier.current.name })}
        </span>
        <span className="text-muted-foreground text-xs font-bold whitespace-nowrap">
          {t("tierNext", { name: `${tier.next.emoji} ${tier.next.name}` })}
        </span>
      </div>

      <p className="text-primary mb-4 text-sm font-semibold">
        {t("tierRemaining", {
          count: tier.remaining,
          name: `${tier.next.emoji} ${tier.next.name}`,
        })}
      </p>

      <div className="text-foreground mb-1.5 flex items-center justify-between text-xs font-bold">
        <span>{t("stampsCount", { count: stampsBalance })}</span>
        <span className="text-muted-foreground">
          {t("stampsCount", { count: tier.next.at })}
        </span>
      </div>
      <div className="bg-card/70 mb-5 h-2.5 overflow-hidden rounded-full">
        <div
          className="from-primary to-primary/50 h-full rounded-full bg-gradient-to-r"
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="bg-card/70 rounded-2xl p-4">
        <p className="text-muted-foreground text-[0.7rem] font-bold tracking-wider uppercase">
          {t("tierUnlocks", { name: `${tier.next.emoji} ${tier.next.name}` })}
        </p>
        <ul className="mt-2.5 flex flex-col gap-2">
          {tier.benefits.map((benefit) => (
            <li
              key={benefit}
              className="text-foreground flex items-center gap-2.5 text-sm"
            >
              <Sparkles className="text-primary size-4 shrink-0" />
              {benefit}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

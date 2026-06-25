"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/lib/trpc/client";

import { tierIcon } from "../lib/tier-icon";
import { AllLevelsSheet } from "./all-levels-sheet";

/**
 * Level standing — a mint hero card showing the current tier, the next one, a
 * progress bar toward it, and the benefits that unlock there. A "ver todos los
 * niveles" action opens the {@link AllLevelsSheet}. On desktop it rides along as
 * a sticky aside next to the catalog (see {@link Rewards}). Reads
 * `rewards.levels` (client query — the data is per-customer + protected).
 */
export function TierCard() {
  const t = useTranslations("Rewards");
  const trpc = useTRPC();
  const { data } = useQuery(trpc.rewards.levels.queryOptions());

  if (!data) {
    return (
      <section className="from-primary/15 to-primary/5 ring-primary/15 rounded-[1.75rem] bg-gradient-to-br p-6 shadow-lg shadow-primary/10 ring-1">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/2" />
        <Skeleton className="mt-5 h-2.5 w-full rounded-full" />
        <Skeleton className="mt-5 h-28 w-full rounded-2xl" />
      </section>
    );
  }

  const { current, next, progress, remainingToNext } = data;
  const pct = next ? Math.min(100, Math.round(progress * 100)) : 100;
  const showcase = next ?? current;
  const CurrentIcon = tierIcon(current.icon);
  const NextIcon = next ? tierIcon(next.icon) : Sparkles;
  const ShowcaseIcon = tierIcon(showcase.icon);

  return (
    <section className="from-primary/15 to-primary/5 ring-primary/15 rounded-[1.75rem] bg-gradient-to-br p-6 shadow-lg shadow-primary/10 ring-1">
      <div className="mb-1 flex items-center justify-between gap-3">
        <span className="font-display text-foreground inline-flex items-center gap-1.5 text-xl font-semibold tracking-tight">
          <CurrentIcon className="text-primary size-5" />
          {t("tierTitle", { name: current.name })}
        </span>
        {next ? (
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap">
            {t("tierNextLabel")} <NextIcon className="size-3.5" /> {next.name}
          </span>
        ) : null}
      </div>

      <p className="text-primary mb-4 text-sm font-semibold">
        {next
          ? t("tierRemainingPoints", { count: remainingToNext, name: next.name })
          : t("tierMax")}
      </p>

      {next ? (
        <>
          <div className="text-foreground mb-1.5 flex items-center justify-between text-xs font-bold">
            <span>{t("tierPointsCount", { count: current.threshold })}</span>
            <span className="text-muted-foreground">
              {t("tierPointsCount", { count: next.threshold })}
            </span>
          </div>
          <div className="bg-card/70 mb-5 h-2.5 overflow-hidden rounded-full">
            <div
              className="from-primary to-primary/50 h-full rounded-full bg-gradient-to-r"
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      ) : null}

      <div className="bg-card/70 rounded-2xl p-4">
        <p className="text-muted-foreground inline-flex items-center gap-1.5 text-[0.7rem] font-bold tracking-wider uppercase">
          <ShowcaseIcon className="size-3.5" />
          {next
            ? t("tierUnlocksLabel", { name: next.name })
            : t("tierBenefitsLabel", { name: current.name })}
        </p>
        <ul className="mt-2.5 flex flex-col gap-2">
          {showcase.benefits.map((benefit) => (
            <li
              key={benefit.label}
              className="text-foreground flex items-center gap-2.5 text-sm"
            >
              <Sparkles className="text-primary size-4 shrink-0" />
              {benefit.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <AllLevelsSheet />
      </div>
    </section>
  );
}

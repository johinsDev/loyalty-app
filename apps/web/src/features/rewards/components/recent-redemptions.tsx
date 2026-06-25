"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { formatDate } from "@loyalty/date";
import { ChevronRight, Gift } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

/**
 * "Canjeadas recientemente" — a compact ledger of the latest redemptions
 * (`rewards.recentRedemptions`, ≤3) so the customer sees their recent claims at
 * a glance, with a "Ver todo" link to the full history. Sits below the catalog.
 */
export function RecentRedemptions() {
  const t = useTranslations("Rewards");
  const locale = useLocale();
  const fade = useFadeUp();
  const trpc = useTRPC();
  const { data, isPending } = useQuery(
    trpc.rewards.recentRedemptions.queryOptions(),
  );

  if (!isPending && (!data || data.length === 0)) return null;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-display text-foreground text-xl font-semibold tracking-tight">
          {t("recentTitle")}
        </h2>
        <Link
          href="/rewards/history"
          className="text-primary inline-flex items-center gap-0.5 text-sm font-bold"
        >
          {t("viewAll")}
          <ChevronRight className="size-4" />
        </Link>
      </div>
      <ul className="bg-card divide-border/70 divide-y rounded-3xl px-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
        {isPending
          ? Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 py-3.5">
                <Skeleton className="size-10 shrink-0 rounded-xl" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </li>
            ))
          : data?.map((item, i) => (
              <li
                key={item.id}
                style={fade(i)}
                className="flex items-center justify-between gap-3 py-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-primary/10 grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl text-lg">
                    {item.rewardImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.rewardImageUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <Gift className="text-primary size-4" />
                    )}
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-foreground truncate text-sm font-bold">
                      {item.rewardName}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t("redeemedOn", {
                        date: formatDate(item.redeemedAt, { locale }),
                      })}
                    </span>
                  </div>
                </div>
                <span className="text-muted-foreground shrink-0 text-sm font-bold">
                  {item.currency === "stamps"
                    ? t("spentStamps", { count: item.stampsSpent })
                    : t("spentPoints", { count: item.pointsSpent })}
                </span>
              </li>
            ))}
      </ul>
    </section>
  );
}

"use client";

import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/lib/trpc/client";

/**
 * The header balance chip — the customer's spendable stamp balance (the currency
 * most rewards are priced in). Client query (`stamps.myWallet`) so the cookie is
 * sent to the cross-origin Worker; the realtime listener invalidates it live.
 */
export function RewardsBalance() {
  const t = useTranslations("Rewards");
  const trpc = useTRPC();
  const { data } = useQuery(trpc.stamps.myWallet.queryOptions());

  if (!data) {
    return <Skeleton className="h-9 w-28 rounded-full" />;
  }

  return (
    <span className="bg-card text-primary inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold whitespace-nowrap shadow-sm ring-1 ring-black/5 dark:ring-white/10">
      🧋 {t("balance", { count: data.currentStamps })}
    </span>
  );
}

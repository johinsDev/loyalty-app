"use client";

import { useQuery } from "@tanstack/react-query";
import { LogOut, TrendingUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import { useActiveStoreId } from "../use-active-store";
import { StoreSwitcher } from "./store-switcher";

/**
 * Compact cashier header — brand + the active store + today's real stamp/point
 * counters for this store, and an exit. Cashier identity / language / theme live
 * in the Profile tab now.
 */
export function CashierHeader() {
  const t = useTranslations("Cashier");
  const locale = useLocale();
  const router = useRouter();
  const trpc = useTRPC();
  const activeStoreId = useActiveStoreId();

  const { data: stores } = useQuery(trpc.employees.myStores.queryOptions());
  const storeName =
    stores?.find((s) => s.id === activeStoreId)?.name ?? stores?.[0]?.name ?? "";

  // Real "today" counters for the active store (org-local day).
  const summary = useQuery(
    trpc.stamps.shiftSummary.queryOptions(
      { storeId: activeStoreId ?? "" },
      { enabled: Boolean(activeStoreId) },
    ),
  );
  const stampsToday = summary.data?.stampsToday ?? 0;
  const pointsToday = summary.data?.pointsToday ?? 0;

  const today = new Date().toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <header className="bg-card border-border flex flex-none items-center gap-3 border-b px-4 py-2.5 sm:px-6">
      <span className="font-display bg-primary text-primary-foreground grid size-9 flex-none place-items-center rounded-xl text-sm font-semibold">
        T4
      </span>
      <div className="min-w-0 leading-tight">
        <div className="font-display truncate text-sm font-semibold">
          {t("registerAt", { store: storeName })}
        </div>
        <div className="text-muted-foreground/70 truncate text-xs font-semibold capitalize">
          {today}
        </div>
      </div>

      <div className="flex-1" />

      <StoreSwitcher />

      <div className="bg-muted flex items-center gap-3 rounded-xl px-3 py-1.5">
        <TrendingUp className="text-muted-foreground size-4 flex-none" />
        <Kpi label={t("stampsToday")} value={stampsToday} />
        <span className="bg-border h-6 w-px flex-none" />
        <Kpi label={t("pointsToday")} value={pointsToday} />
      </div>

      <button
        type="button"
        onClick={() => router.push("/dashboard")}
        aria-label={t("exit")}
        className="border-border bg-card text-muted-foreground hover:text-foreground grid size-10 flex-none place-items-center rounded-xl border"
      >
        <LogOut className="size-4" />
      </button>
    </header>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <div className="leading-tight">
      <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
        {label}
      </div>
      <div className="text-foreground text-sm font-extrabold tabular-nums">{value}</div>
    </div>
  );
}

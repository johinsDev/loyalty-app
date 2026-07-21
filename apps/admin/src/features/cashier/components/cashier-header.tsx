"use client";

import { LogOut, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/nav";

import { DAILY_CAP, STAMPS_TODAY, store } from "../data";
import { StoreSwitcher } from "./store-switcher";

/**
 * Compact cashier header — brand + shift + the per-cashier daily stamp counter
 * and an exit. Cashier identity / language / theme live in the Profile tab now.
 */
export function CashierHeader() {
  const t = useTranslations("Cashier");
  const router = useRouter();
  const capReached = STAMPS_TODAY >= DAILY_CAP;

  return (
    <header className="bg-card border-border flex flex-none items-center gap-3 border-b px-4 py-2.5 sm:px-6">
      <span className="font-display bg-primary text-primary-foreground grid size-9 flex-none place-items-center rounded-xl text-sm font-semibold">
        T4
      </span>
      <div className="min-w-0 leading-tight">
        <div className="font-display truncate text-sm font-semibold">
          {t("registerAt", { store: store.name })}
        </div>
        <div className="text-muted-foreground/70 truncate text-xs font-semibold">
          {store.shift}
        </div>
      </div>

      <div className="flex-1" />

      <StoreSwitcher />

      <div className="bg-muted flex items-center gap-2 rounded-xl px-3 py-1.5">
        <TrendingUp className="text-muted-foreground size-4" />
        <div className="leading-tight">
          <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
            {t("stampsToday")}
          </div>
          <div
            className={`text-sm font-extrabold ${capReached ? "text-amber-600" : "text-foreground"}`}
          >
            {STAMPS_TODAY}{" "}
            <span className="text-muted-foreground/70 font-bold">
              / {DAILY_CAP}
            </span>
          </div>
        </div>
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

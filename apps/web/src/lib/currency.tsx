"use client";

import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";

import { useTRPC } from "@/lib/trpc/client";

interface CurrencyContextValue {
  /** Active currency (cookie, clamped to enabled; falls back to default). */
  currency: string;
  /** Org default currency — used for amounts stored in the store's currency
   *  (e.g. purchase totals) regardless of the active selection. */
  defaultCurrency: string;
  enabledCurrencies: string[];
  enabledLocales: string[];
  setCurrency: (currency: string) => void;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

const COOKIE = "NEXT_CURRENCY";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.split("=")[1];
}

/**
 * Surfaces the org's localization config (enabled locales/currencies + defaults)
 * and the active currency to the customer app. Reads the public `settings.
 * localization` query + the `NEXT_CURRENCY` cookie. Switching writes the cookie
 * and reloads so RSC + the Worker re-resolve everything for the new currency.
 */
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.settings.localization.queryOptions());

  const defaultCurrency = data?.defaultCurrency ?? "COP";
  const enabledCurrencies = data?.enabledCurrencies ?? ["COP"];
  const enabledLocales = data?.enabledLocales ?? ["es"];

  const cookie = readCookie(COOKIE);
  const currency =
    cookie && enabledCurrencies.includes(cookie) ? cookie : defaultCurrency;

  const setCurrency = (next: string) => {
    // eslint-disable-next-line unicorn/no-document-cookie -- simple first-party preference cookie
    document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  };

  return (
    <CurrencyContext.Provider
      value={{ currency, defaultCurrency, enabledCurrencies, enabledLocales, setCurrency }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    // Safe default outside the provider (e.g. isolated tests).
    return {
      currency: "COP",
      defaultCurrency: "COP",
      enabledCurrencies: ["COP"],
      enabledLocales: ["es"],
      setCurrency: () => undefined,
    };
  }
  return ctx;
}

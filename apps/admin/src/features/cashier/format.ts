"use client";

import { useFormatter } from "next-intl";
import { useCallback } from "react";

import { money } from "@/lib/money";

/**
 * Money for the register.
 *
 * Every cashier view used to carry its own six-line `formatCop`, pinned to
 * `es-CO` / `COP` — five identical copies, so a cashier running the app in
 * English still read Colombian-formatted prices while the rest of admin
 * localized them. This routes the whole segment through the same `money()` the
 * CRM uses, which is locale-aware and pins fraction digits so SSR and client
 * agree.
 */
export function useCashierMoney(currency = "COP") {
  const format = useFormatter();
  return useCallback(
    (cents: number) => money(format, cents, currency),
    [format, currency],
  );
}

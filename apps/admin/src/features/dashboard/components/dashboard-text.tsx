"use client";

import { useTranslations } from "next-intl";

/**
 * Client-rendered Dashboard i18n text. Lets the dashboard page render its shell
 * (titles + card frames) with **no top-level `getTranslations`** — a top-level
 * `await` de-opts the static shell and freezes navigation (the customers-list
 * bug). SSR'd from the `NextIntlClientProvider` messages, so titles still appear
 * in the prerendered shell; server widgets keep using `getTranslations` inside
 * their Suspense holes.
 */
export function DText({ k }: { k: string }) {
  const t = useTranslations("Dashboard");
  return t(k);
}

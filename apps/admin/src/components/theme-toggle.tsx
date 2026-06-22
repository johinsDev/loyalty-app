"use client";

import { ModeSegmentedSystem } from "@loyalty/ui";
import { useTranslations } from "next-intl";

/**
 * App wrapper that localises the shared `ModeSegmentedSystem` from `@loyalty/ui`
 * (System / Light / Dark as an icon-only segmented control, Vercel-style).
 * Mirrors the customer app's `ThemeToggle` — i18n lives here, next-themes stays
 * in the UI package.
 */
export function ThemeToggle() {
  const t = useTranslations("Theme");
  return <ModeSegmentedSystem aria-label={t("toggleTheme")} />;
}

"use client";

import { ModeSegmented } from "@loyalty/ui";
import { useTranslations } from "next-intl";

/**
 * App wrapper that localises the shared `ModeSegmented` from `@loyalty/ui`
 * (which stays i18n-agnostic). Mirrors `LocaleSwitcher`.
 */
export function ThemeToggle() {
  const t = useTranslations("Theme");
  return (
    <ModeSegmented
      aria-label={t("toggleTheme")}
      labels={{ light: t("light"), dark: t("dark") }}
    />
  );
}

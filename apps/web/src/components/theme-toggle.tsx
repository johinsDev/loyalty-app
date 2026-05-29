"use client";

import { ModeToggle } from "@loyalty/ui";
import { useTranslations } from "next-intl";

/**
 * App wrapper that localises the shared `ModeToggle` from `@loyalty/ui`
 * (which stays i18n-agnostic). Mirrors `LocaleSwitcher`.
 */
export function ThemeToggle() {
  const t = useTranslations("Theme");
  return (
    <ModeToggle
      labels={{
        light: t("light"),
        dark: t("dark"),
        system: t("system"),
        toggle: t("toggleTheme"),
      }}
    />
  );
}

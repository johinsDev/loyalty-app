"use client";

import { SegmentedControl } from "@loyalty/ui";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

type ThemeValue = "system" | "light" | "dark";

/**
 * Theme picker as an icon-only segmented control (System / Light / Dark),
 * matching Vercel's. Reads the chosen `theme` (not the resolved one) so
 * "System" can stay selected; mount-guarded to avoid a hydration mismatch
 * (server + first client render resolve to `system`, then the effect swaps in
 * the real value — same markup on both passes).
 */
export function ThemeToggle() {
  const t = useTranslations("Theme");
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const value: ThemeValue =
    mounted && (theme === "light" || theme === "dark") ? theme : "system";

  return (
    <SegmentedControl<ThemeValue>
      aria-label={t("toggleTheme")}
      value={value}
      onValueChange={setTheme}
      className="gap-0.5 p-0.5"
      options={[
        { value: "system", label: "", icon: Monitor },
        { value: "light", label: "", icon: Sun },
        { value: "dark", label: "", icon: Moon },
      ]}
    />
  );
}

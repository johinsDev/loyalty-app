"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import { SegmentedControl } from "./segmented-control";

export interface ModeSegmentedLabels {
  light: string;
  dark: string;
}

const DEFAULT_LABELS: ModeSegmentedLabels = { light: "Light", dark: "Dark" };

/**
 * Light / Dark theme as a {@link SegmentedControl} (the Mode picker without the
 * "system" option, matching the Preferences design). Unlike {@link ModeToggle}
 * this reads the active theme to highlight the chip, so it needs a mount guard:
 * server + first client render both resolve to `light`, then the effect swaps in
 * the real theme — same markup on both passes, no hydration mismatch.
 */
export function ModeSegmented({
  labels = DEFAULT_LABELS,
  "aria-label": ariaLabel,
}: {
  labels?: ModeSegmentedLabels;
  "aria-label"?: string;
}) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const value: "light" | "dark" =
    mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <SegmentedControl
      aria-label={ariaLabel}
      value={value}
      onValueChange={setTheme}
      options={[
        { value: "light", label: labels.light, icon: SunIcon },
        { value: "dark", label: labels.dark, icon: MoonIcon },
      ]}
    />
  );
}

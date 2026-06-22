"use client";

import { SegmentedControl } from "@loyalty/ui";
import { LayoutGrid, List } from "lucide-react";

export type ViewMode = "grid" | "list";

/**
 * Grid / list view switch for resource lists — an icon-only segmented control.
 * Reusable across every admin list so they all flip layout the same way.
 */
export function ViewToggle({
  value,
  onValueChange,
  ariaLabel,
}: {
  value: ViewMode;
  onValueChange: (value: ViewMode) => void;
  ariaLabel: string;
}) {
  return (
    <SegmentedControl<ViewMode>
      aria-label={ariaLabel}
      value={value}
      onValueChange={onValueChange}
      className="gap-0.5 p-0.5"
      options={[
        { value: "grid", label: "", icon: LayoutGrid },
        { value: "list", label: "", icon: List },
      ]}
    />
  );
}

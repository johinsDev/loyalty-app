"use client";

import { cn } from "@loyalty/ui";
import type { Column } from "@tanstack/react-table";
import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";

/** Clickable, sortable column header (toggles asc → desc for this column). */
export function DataTableColumnHeader<T>({
  column,
  title,
  className,
}: {
  column: Column<T, unknown>;
  title: string;
  className?: string;
}) {
  if (!column.getCanSort()) {
    return <span className={cn("text-muted-foreground text-xs font-bold", className)}>{title}</span>;
  }
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn(
        "text-muted-foreground hover:text-foreground -ml-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs font-bold transition-colors",
        className,
      )}
    >
      {title}
      {sorted === "asc" ? (
        <ChevronUp className="size-3.5" />
      ) : sorted === "desc" ? (
        <ChevronDown className="size-3.5" />
      ) : (
        <ChevronsUpDown className="size-3.5 opacity-60" />
      )}
    </button>
  );
}

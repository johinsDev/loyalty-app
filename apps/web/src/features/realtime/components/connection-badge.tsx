"use client";

import { cn } from "@loyalty/ui";

import type { ConnectionStatus } from "@loyalty/realtime/client";

interface Props {
  status: ConnectionStatus;
  className?: string;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  idle: "idle",
  connecting: "connecting…",
  open: "live",
  closed: "offline",
};

/**
 * Pill that surfaces the WebSocket status. Designed to be small +
 * unobtrusive — drop it in dev pages and feature-flagged debug panels.
 */
export function ConnectionBadge({ status, className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2 py-0.5 text-xs",
        status === "open" &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        status === "connecting" &&
          "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        (status === "closed" || status === "idle") &&
          "border-muted-foreground/20 bg-muted text-muted-foreground",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full",
          status === "open" && "bg-emerald-500",
          status === "connecting" && "animate-pulse bg-amber-500",
          (status === "closed" || status === "idle") &&
            "bg-muted-foreground/60",
        )}
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

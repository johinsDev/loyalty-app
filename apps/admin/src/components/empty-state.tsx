import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Consistent empty / no-results state for any resource list — an icon in a soft
 * tile, a title, a hint, and an optional action (e.g. "clear filters" or "add").
 */
export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="bg-muted text-muted-foreground grid size-14 place-items-center rounded-2xl">
        <Icon className="size-6" />
      </span>
      <h3 className="font-display mt-4 text-lg font-semibold tracking-tight">
        {title}
      </h3>
      {hint ? (
        <p className="text-muted-foreground mt-1 max-w-xs text-sm font-medium">
          {hint}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

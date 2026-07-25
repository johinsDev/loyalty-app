import { Skeleton } from "@loyalty/ui";

/**
 * Fallbacks for the store shell's streamed holes. The frame (rails + top bar) is
 * static, so only the nav and greeting need placeholders — sized to match their
 * real components so filling the hole causes no layout shift.
 */

const NAV_ROWS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

/** Matches {@link AdminNav}: brand row + search + grouped rows + footer. */
export function NavSkeleton() {
  return (
    <div className="bg-card flex h-full flex-col">
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Skeleton className="size-9 flex-none rounded-xl" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>
      <div className="px-3 py-2">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>
      <div className="flex-1 space-y-2 px-3 py-2">
        {NAV_ROWS.map((row) => (
          <Skeleton key={row} className="h-10 w-full rounded-lg" />
        ))}
      </div>
      <div className="border-border flex items-center gap-2 border-t p-2">
        <Skeleton className="size-8 flex-none rounded-full" />
        <Skeleton className="h-4 flex-1" />
      </div>
    </div>
  );
}

/** Matches the greeting hole: title line + subtitle line. */
export function GreetingSkeleton() {
  return (
    <div className="min-w-0 flex-1 space-y-2">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

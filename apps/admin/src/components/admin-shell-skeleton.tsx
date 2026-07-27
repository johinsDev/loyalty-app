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

/** Matches the top-bar scope islands: store switcher (sm+) + cashier button. */
export function ScopeIslandsSkeleton() {
  return (
    <>
      <Skeleton className="hidden h-10 w-40 rounded-xl sm:block" />
      <Skeleton className="h-10 w-28 rounded-xl" />
    </>
  );
}

const PAGE_BLOCKS = ["a", "b", "c", "d"] as const;

/**
 * Neutral fallback for the shell's page hole (`{children}`), shown while a page
 * that awaits at its top level (dashboard, settings, detail, analytics) streams
 * in. Deliberately shape-agnostic — a header + a content grid — so it doesn't
 * flash a table-shaped skeleton on non-list pages. List pages render their own
 * header synchronously and stream only their table, so they never hit this.
 */
export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PAGE_BLOCKS.map((b) => (
          <Skeleton key={b} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-64 w-full rounded-2xl" />
    </div>
  );
}

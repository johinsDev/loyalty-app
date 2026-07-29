import { Skeleton } from "@loyalty/ui";

/**
 * Generic loading UI for the config/section pages (settings, loyalty, shortlinks,
 * analytics, audit, …). These render a client view that self-fetches; wrapping
 * that view in a `<Suspense fallback={<SectionSkeleton/>}>` (behind an
 * `IslandBoundary`) lets the route prerender a static shell (◐) and shows an
 * instant, exact-ish placeholder while the view streams in. A deliberately
 * generic shape (title + subtitle + two content cards).
 */
export function SectionSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8">
      <Skeleton className="h-8 w-52" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    </div>
  );
}

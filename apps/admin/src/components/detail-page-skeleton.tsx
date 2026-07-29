import { Skeleton } from "@loyalty/ui";

/**
 * Instant loading UI for admin `[id]` detail routes. These pages `await` an
 * (uncached) Worker read before they can render, and Next's soft navigation is a
 * transition that keeps the previous page visible until the new one is ready — so
 * without a per-segment boundary the click feels like a ~1-2s hang. A route
 * `loading.tsx` re-exporting this gives the segment its own boundary that Next
 * shows immediately, so the click is instant and the detail streams in behind it.
 *
 * A deliberately generic shape (back link → identity header + actions → stat
 * tiles → body card) that approximates every detail view closely enough for a
 * transient state; bespoke per-view skeletons (e.g. {@link CustomerDetailLoading})
 * are only worth it when a view's layout differs a lot.
 */
export function DetailPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <Skeleton className="h-4 w-24" />

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 flex-none rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {["a", "b", "c", "d"].map((tile) => (
          <Skeleton key={tile} className="h-24 rounded-2xl" />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

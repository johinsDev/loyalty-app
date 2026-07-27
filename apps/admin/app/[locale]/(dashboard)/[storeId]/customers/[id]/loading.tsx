import { Skeleton } from "@loyalty/ui";

/**
 * Instant loading UI for the customer detail route. The page awaits two
 * (uncached) Worker reads before it can render, and Next's soft navigation is a
 * transition that keeps the previous page visible until the new one is ready —
 * so without a per-segment boundary the click feels like a ~1-2s hang. This
 * `loading.tsx` gives the `[id]` segment its own boundary, which Next shows
 * immediately on navigation, so the click is instant and the data streams in.
 * Shaped like {@link Customer360}: back link + identity header + tabs.
 */
export default function CustomerDetailLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-6 lg:px-8">
      <Skeleton className="h-4 w-24" />

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 flex-none rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </div>

      <div className="mt-6 flex gap-2 border-b pb-px">
        {["overview", "activity", "loyalty", "purchases"].map((tab) => (
          <Skeleton key={tab} className="h-9 w-24 rounded-lg" />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {["a", "b", "c", "d"].map((tile) => (
          <Skeleton key={tile} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-4 h-72 w-full rounded-2xl" />
    </div>
  );
}

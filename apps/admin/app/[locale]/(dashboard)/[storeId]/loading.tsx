import { Skeleton } from "@loyalty/ui";

import { DataTableSkeleton } from "@/components/data-table";

/**
 * Streaming fallback for every store-scoped page. The `AdminShell` chrome lives
 * in the parent layout (preserved across navigation), so on a click this paints
 * instantly while the page RSC — which pays the Worker→Turso hop — streams in
 * behind it. Neutral enough for both the list pages and the dashboard.
 */
export default function StoreLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-32 flex-none rounded-xl" />
      </div>
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-10 w-24 rounded-xl" />
      </div>
      <DataTableSkeleton />
    </div>
  );
}

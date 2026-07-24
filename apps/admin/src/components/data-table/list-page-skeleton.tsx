import { Skeleton } from "@loyalty/ui";

import { DataTableSkeleton } from "./data-table-skeleton";

/**
 * Full-page skeleton for an admin list route's `loading.tsx` — header + toolbar
 * + table. Tailored to the list pages (which ARE tables), unlike a blanket
 * layout-level skeleton. Non-table routes (dashboard, settings) get their own.
 */
export function ListPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-10 w-32 flex-none rounded-xl" />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Skeleton className="h-10 w-full rounded-xl sm:w-64" />
        <Skeleton className="h-10 w-24 rounded-xl" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-10 w-24 rounded-xl" />
          <Skeleton className="h-10 w-24 rounded-xl" />
        </div>
      </div>
      <div className="mt-4">
        <DataTableSkeleton />
      </div>
    </div>
  );
}

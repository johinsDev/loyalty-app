import { Skeleton } from "@loyalty/ui";

import { ListPageSkeleton } from "@/components/data-table";

/**
 * Static fallback for the store shell's Suspense boundary — the sidebar + top
 * bar frame with a generic page skeleton in the content slot. Shown only while
 * the auth-gated shell (role, store scope, nav counts) resolves on first load /
 * store switch; page-to-page navigation uses the inner content skeleton instead.
 */
export function AdminShellSkeleton() {
  return (
    <div className="bg-card flex h-screen overflow-hidden">
      <aside className="border-border hidden w-64 flex-none border-r p-4 lg:block">
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="mt-6 space-y-2">
          {["home", "customers", "purchases", "rewards", "promos", "banners", "team", "settings"].map(
            (row) => (
              <Skeleton key={row} className="h-9 w-full rounded-lg" />
            ),
          )}
        </div>
      </aside>
      <div className="bg-muted/30 flex min-w-0 flex-1 flex-col">
        <header className="bg-card border-border flex flex-none items-center gap-3 border-b px-4 py-3 lg:px-6">
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-10 w-40 rounded-xl" />
          <Skeleton className="h-10 w-28 rounded-xl" />
        </header>
        <main className="flex-1 overflow-y-auto">
          <ListPageSkeleton />
        </main>
      </div>
    </div>
  );
}

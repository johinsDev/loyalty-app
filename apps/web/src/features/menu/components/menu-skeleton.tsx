import { Skeleton } from "@loyalty/ui";

/** Grid skeleton for the menu while the first page loads. */
export function MenuGridSkeleton({ count = 6 }: { count?: number }) {
  const keys = Array.from({ length: count }, (_, i) => `menu-skeleton-${i}`);
  return (
    <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
      {keys.map((key) => (
        <div
          key={key}
          className="bg-card overflow-hidden rounded-3xl ring-1 ring-black/5 dark:ring-white/10"
        >
          <Skeleton className="h-28 w-full rounded-none" />
          <div className="flex flex-col gap-2 p-3.5">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

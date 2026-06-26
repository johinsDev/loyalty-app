import { Skeleton } from "@loyalty/ui";

/** Loading placeholder for the purchase history list (matches the row layout). */
export function PurchaseHistorySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          key={i}
          className="bg-card flex items-center gap-3 rounded-3xl p-3.5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10"
        >
          <Skeleton className="size-[3.125rem] flex-none rounded-2xl" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}

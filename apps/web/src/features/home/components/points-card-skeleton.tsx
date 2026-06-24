import { Skeleton } from "@loyalty/ui";

/**
 * Streaming fallback for `<PointsCard />` — mirrors the ring + balance + tier
 * bar so the shell streams with zero layout shift when the summary hydrates in.
 */
export function PointsCardSkeleton() {
  return (
    <section className="from-primary/5 to-primary/20 rounded-3xl bg-gradient-to-br p-7 shadow-xl">
      <div className="flex flex-col items-center">
        <Skeleton className="size-44 rounded-full" />
        <Skeleton className="mt-4 mb-5 h-4 w-40" />
      </div>
      <div className="mb-1.5 flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-20" />
      </div>
      <Skeleton className="h-2.5 w-full rounded-full" />
    </section>
  );
}

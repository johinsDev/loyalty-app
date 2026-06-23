import { Skeleton } from "@loyalty/ui";

/**
 * Streaming fallback for `<StampsCard />` — mirrors its exact card (rounded-3xl
 * surface, title + count pill, the "remaining" line, and the 5×2 stamp grid) so
 * the shell streams with zero layout shift when the real wallet hydrates in.
 */
export function StampsCardSkeleton() {
  return (
    <section className="bg-card rounded-3xl p-6 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
      <div className="mb-1.5 flex items-center justify-between">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-6 w-14 rounded-full" />
      </div>
      <Skeleton className="mb-4 h-4 w-52" />
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-full" />
        ))}
      </div>
    </section>
  );
}

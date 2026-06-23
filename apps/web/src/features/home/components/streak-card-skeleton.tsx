import { Skeleton } from "@loyalty/ui";

/**
 * Streaming fallback for `<StreakCard />` — mirrors its exact card (flame badge +
 * title/sub, then the 7-day week strip) so the shell streams with zero layout
 * shift when the real streak hydrates in.
 */
export function StreakCardSkeleton() {
  return (
    <section className="bg-card rounded-3xl p-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="size-12 flex-none rounded-2xl" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-52" />
        </div>
      </div>
      <div className="flex justify-between gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <Skeleton className="aspect-square w-full max-w-11 rounded-2xl" />
            <Skeleton className="h-3 w-3" />
          </div>
        ))}
      </div>
    </section>
  );
}

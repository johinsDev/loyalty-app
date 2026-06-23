import { Skeleton } from "@loyalty/ui";

/**
 * Streaming fallback for `<CardLive />` — mirrors its exact layout (the wallet
 * block with a 5-col, 10-cell stamp grid + a progress line, and a 4-row history
 * card) so the shell streams with no layout shift when the data hydrates in.
 */
export function CardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Wallet */}
      <section className="bg-muted rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-10" />
        </div>
        <div className="mt-5 grid grid-cols-5 gap-2.5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-full" />
          ))}
        </div>
        <Skeleton className="mt-4 h-4 w-48" />
      </section>

      {/* History */}
      <section className="bg-card border-border rounded-3xl border p-5 shadow-sm">
        <Skeleton className="h-5 w-24" />
        <div className="mt-3 space-y-3.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-4 w-10" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

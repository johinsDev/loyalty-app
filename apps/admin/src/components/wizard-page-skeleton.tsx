import { Skeleton } from "@loyalty/ui";

/**
 * Instant loading UI for the create/edit wizard routes (`/new`, `/[id]`,
 * `/[id]/edit`). Those pages `await` a Worker read before rendering, and Next's
 * soft navigation keeps the previous page on screen until the new one is ready —
 * so without a per-segment boundary the click just hangs. A route `loading.tsx`
 * re-exporting this gives the segment its own boundary Next can show at once.
 *
 * Mirrors {@link WizardShell}: title, stepper, the step form on the left and the
 * sticky preview on the right, footer buttons.
 */
export function WizardPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8">
      <Skeleton className="h-7 w-52" />

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {["a", "b", "c", "d", "e"].map((step) => (
          <Skeleton key={step} className="h-8 w-28 rounded-full" />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          {["one", "two"].map((block) => (
            <div key={block} className="border-border space-y-4 rounded-2xl border p-5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Skeleton className="h-10 w-24 rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-xl" />
      </div>
    </div>
  );
}

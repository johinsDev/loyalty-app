"use client";

import { Button } from "@loyalty/ui";
import { RefreshCwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * Forces the current Server Component tree to re-fetch AND shows the
 * Suspense fallback during the round-trip.
 *
 * `router.refresh()` alone is invisible — the existing UI stays
 * mounted while the new tree streams in. The outbox lists key their
 * `<Suspense>` on the raw `searchParams`, so flipping a `_r` query
 * param invalidates the boundary → React unmounts the table →
 * `OutboxTableSkeleton` renders → new data streams in.
 *
 * `router.replace` instead of `push` so refresh clicks don't pollute
 * the back-button history.
 */
export function RefreshButton() {
  const t = useTranslations("Common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    const next = new URLSearchParams(searchParams);
    next.set("_r", Date.now().toString());
    startTransition(() => {
      router.replace(`${pathname}?${next.toString()}`);
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isPending}
      aria-busy={isPending}
    >
      <RefreshCwIcon
        className={isPending ? "size-4 animate-spin" : "size-4"}
        aria-hidden
      />
      {t("refresh")}
    </Button>
  );
}

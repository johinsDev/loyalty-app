"use client";

import { formatDate } from "@loyalty/date";
import { DateRangePicker, Skeleton } from "@loyalty/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { parseAsString, useQueryStates } from "nuqs";
import { useEffect, useRef } from "react";

import { money } from "@/features/menu/components/product-card";
import { Link, useRouter } from "@/i18n/navigation";
import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

const toIso = (date: string | null, endOfDay: boolean) => {
  if (!date) return undefined;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d.toISOString();
};

/** Bridge the nuqs `YYYY-MM-DD` strings ↔ the DatePicker's local `Date`. */
const ymdToDate = (s: string | null): Date | undefined => {
  if (!s) return undefined;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};
const dateToYmd = (d: Date | undefined): string | null => {
  if (!d) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
};

/**
 * Full stamps history — every purchase earns exactly one stamp, so the stamp
 * ledger is just the purchase list. Mirrors `PointsHistory`: infinite
 * `purchases.myPurchases` + from/to date-range filter (nuqs). Each row shows
 * the stamps earned + the amount; tapping it opens the shared `/compras/[id]`
 * detail. Client component.
 */
export function StampsHistory() {
  const t = useTranslations("StampsHistory");
  const locale = useLocale();

  const [range, setRange] = useQueryStates({
    from: parseAsString,
    to: parseAsString,
  });

  return (
    <div className="mx-auto w-full max-w-md px-5 pt-14 pb-32 md:pb-12 lg:max-w-5xl lg:px-8 lg:pt-12">
      <Link
        href="/"
        className="text-muted-foreground mb-3 inline-flex items-center gap-1 text-sm font-bold"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>
      <h1 className="font-display mb-5 text-3xl font-semibold tracking-tight">
        {t("title")}
      </h1>

      <div className="mb-5 lg:max-w-xl">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-bold">
            {t("dateRange")}
          </span>
          <DateRangePicker
            value={{ from: ymdToDate(range.from), to: ymdToDate(range.to) }}
            onValueChange={(r) =>
              void setRange({
                from: dateToYmd(r.from),
                to: dateToYmd(r.to),
              })
            }
            placeholder={t("dateRange")}
            clearLabel={t("clear")}
            applyLabel={t("apply")}
            formatLabel={(d) => formatDate(d, { locale })}
            disableFuture
          />
        </label>
      </div>

      <StampsHistoryList
        from={toIso(range.from, false)}
        to={toIso(range.to, true)}
      />
    </div>
  );
}

function StampsHistoryList({ from, to }: { from?: string; to?: string }) {
  const t = useTranslations("StampsHistory");
  const locale = useLocale();
  const format = useFormatter();
  const fade = useFadeUp();
  const router = useRouter();
  const trpc = useTRPC();

  const query = useInfiniteQuery(
    trpc.purchases.myPurchases.infiniteQueryOptions(
      { from, to, limit: 20 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    ),
  );

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (
        entries[0]?.isIntersecting &&
        query.hasNextPage &&
        !query.isFetchingNextPage
      ) {
        void query.fetchNextPage();
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [query.hasNextPage, query.isFetchingNextPage, query]);

  if (query.isPending) {
    return (
      <ul className="bg-card divide-border/70 divide-y rounded-3xl px-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="flex items-center gap-3 py-3.5">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-muted-foreground rounded-3xl border border-dashed py-10 text-center text-sm">
        {t("empty")}
      </p>
    );
  }

  return (
    <>
      <ul className="bg-card divide-border/70 divide-y rounded-3xl px-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
        {items.map((item, i) => (
          <li key={item.id} style={fade(i)}>
            <button
              type="button"
              onClick={() =>
                router.push({
                  pathname: "/compras/[id]",
                  params: { id: item.id },
                })
              }
              className="hover:bg-muted/40 -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-2xl px-2 py-3.5 text-left transition-colors"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-primary/10 grid size-10 shrink-0 place-items-center rounded-xl text-lg">
                  🧋
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="text-foreground truncate text-sm font-bold">
                    {money(format, item.totalCents, item.currency)}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {t("on", { date: formatDate(item.createdAt, { locale }) })}
                  </span>
                </div>
              </div>
              <span className="text-primary shrink-0 text-sm font-extrabold">
                +{item.stampsEarned} 🧋
              </span>
            </button>
          </li>
        ))}
      </ul>
      {query.isFetchingNextPage ? (
        <p className="text-muted-foreground py-4 text-center text-sm font-semibold">
          {t("loadingMore")}
        </p>
      ) : null}
      <div ref={sentinelRef} aria-hidden className="h-px" />
    </>
  );
}

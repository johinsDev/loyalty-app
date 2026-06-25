"use client";

import {
  DateRangePicker,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
  Skeleton,
} from "@loyalty/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { formatDate } from "@loyalty/date";
import { ArrowLeft, Gift } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { parseAsString, useQueryStates } from "nuqs";
import { useEffect, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
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
 * Full redemption history (`rewards.history`) — an infinite list of past claims
 * with an optional from/to date range filter (nuqs). Each row shows the reward,
 * when it was redeemed, and the amount spent. Client component.
 */
export function RedemptionHistory() {
  const t = useTranslations("Rewards");
  const locale = useLocale();

  const [range, setRange] = useQueryStates({
    from: parseAsString,
    to: parseAsString,
  });

  return (
    <div className="mx-auto w-full max-w-md px-5 pt-14 pb-32 md:pb-12 lg:max-w-5xl lg:px-8 lg:pt-12">
      <Link
        href="/rewards"
        className="text-muted-foreground mb-3 inline-flex items-center gap-1 text-sm font-bold"
      >
        <ArrowLeft className="size-4" />
        {t("backToRewards")}
      </Link>
      <h1 className="font-display mb-5 text-3xl font-semibold tracking-tight">
        {t("historyTitle")}
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

      <RedemptionHistoryList
        from={toIso(range.from, false)}
        to={toIso(range.to, true)}
      />
    </div>
  );
}

/**
 * The paginated redemption list itself — `rewards.history` infinite query +
 * loading skeleton + empty state + infinite-scroll sentinel, with no page
 * chrome. Shared by the standalone history page and the "Canjeadas" catalog tab
 * (FIX 2), so both show the same data/shape as "Canjeadas recientemente". An
 * optional from/to range narrows the query.
 */
export function RedemptionHistoryList({
  from,
  to,
}: {
  from?: string;
  to?: string;
} = {}) {
  const t = useTranslations("Rewards");
  const locale = useLocale();
  const fade = useFadeUp();
  const trpc = useTRPC();

  const query = useInfiniteQuery(
    trpc.rewards.history.infiniteQueryOptions(
      { from, to, limit: 20 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    ),
  );

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];
  const [selected, setSelected] = useState<(typeof items)[number] | null>(null);

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
        {t("emptyHistory")}
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
              onClick={() => setSelected(item)}
              className="hover:bg-muted/40 -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-2xl px-2 py-3.5 text-left transition-colors"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-primary/10 grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl text-lg">
                  {item.rewardImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.rewardImageUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    <Gift className="text-primary size-4" />
                  )}
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="text-foreground truncate text-sm font-bold">
                    {item.rewardName}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {t("redeemedOn", {
                      date: formatDate(item.redeemedAt, { locale }),
                    })}
                  </span>
                </div>
              </div>
              <span className="text-muted-foreground shrink-0 text-sm font-bold">
                {item.currency === "stamps"
                  ? t("spentStamps", { count: item.stampsSpent })
                  : t("spentPoints", { count: item.pointsSpent })}
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

      <ResponsiveModal
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-sm">
          {selected ? (
            <div className="flex flex-col items-center gap-2 px-6 pt-2 pb-6 text-center">
              <span className="bg-primary/10 grid size-16 place-items-center overflow-hidden rounded-2xl">
                {selected.rewardImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selected.rewardImageUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <Gift className="text-primary size-7" />
                )}
              </span>
              <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
                {selected.rewardName}
              </ResponsiveModalTitle>
              <ResponsiveModalDescription className="text-muted-foreground text-sm">
                {t("redeemedOn", {
                  date: formatDate(selected.redeemedAt, { locale }),
                })}
              </ResponsiveModalDescription>
              <div className="text-primary font-display mt-3 text-4xl font-semibold tabular-nums">
                {selected.currency === "stamps"
                  ? t("spentStamps", { count: selected.stampsSpent })
                  : t("spentPoints", { count: selected.pointsSpent })}
              </div>
            </div>
          ) : null}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

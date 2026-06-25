"use client";

import { formatDate } from "@loyalty/date";
import {
  DateRangePicker,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalTitle,
  Skeleton,
} from "@loyalty/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, Gift, ShoppingBag, Sparkles, Wallet } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { parseAsString, useQueryStates } from "nuqs";
import { type ComponentType, useEffect, useRef, useState } from "react";

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

/** Bridge the nuqs `YYYY-MM-DD` strings ↔ the DatePicker's local `Date` (parse
 *  + format by local parts so the calendar day never shifts across the TZ). */
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

const KIND_ICON: Record<string, ComponentType<{ className?: string }>> = {
  purchase: ShoppingBag,
  reward: Gift,
  adjust: Sparkles,
  other: Wallet,
};

/**
 * Full points ledger (`points.myTransactions`) — an infinite list of every
 * earn / redeem / adjust with an optional from/to date-range filter (nuqs).
 * Rows read as friendly labels ("Compraste", "Canjeaste {premio}", "Ajuste")
 * straight from the structured server fields; negative amounts render in red.
 * Client component.
 */
export function PointsHistory() {
  const t = useTranslations("PointsHistory");
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

      <PointsHistoryList
        from={toIso(range.from, false)}
        to={toIso(range.to, true)}
      />
    </div>
  );
}

function PointsHistoryList({ from, to }: { from?: string; to?: string }) {
  const t = useTranslations("PointsHistory");
  const locale = useLocale();
  const format = useFormatter();
  const fade = useFadeUp();
  const trpc = useTRPC();

  const query = useInfiniteQuery(
    trpc.points.myTransactions.infiniteQueryOptions(
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
        {t("empty")}
      </p>
    );
  }

  return (
    <>
      <ul className="bg-card divide-border/70 divide-y rounded-3xl px-5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
        {items.map((item, i) => {
          const Icon = KIND_ICON[item.kind] ?? Wallet;
          const negative = item.points < 0;
          return (
            <li key={item.id} style={fade(i)}>
              <button
                type="button"
                onClick={() => setSelected(item)}
                className="hover:bg-muted/40 -mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-2xl px-2 py-3.5 text-left transition-colors"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="bg-primary/10 grid size-10 shrink-0 place-items-center rounded-xl">
                    <Icon className="text-primary size-4" />
                  </span>
                  <div className="flex min-w-0 flex-col">
                    <span className="text-foreground truncate text-sm font-bold">
                      {labelFor(item, t)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {t("on", { date: formatDate(item.createdAt, { locale }) })}
                    </span>
                  </div>
                </div>
                <span
                  className={`shrink-0 text-sm font-extrabold ${
                    negative ? "text-red-600 dark:text-red-400" : "text-primary"
                  }`}
                >
                  {item.points > 0 ? `+${item.points}` : item.points}
                </span>
              </button>
            </li>
          );
        })}
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
          {selected
            ? (() => {
                const Icon = KIND_ICON[selected.kind] ?? Wallet;
                const negative = selected.points < 0;
                return (
                  <div className="flex flex-col items-center gap-2 px-6 pt-2 pb-6 text-center">
                    <span className="bg-primary/10 grid size-14 place-items-center rounded-2xl">
                      <Icon className="text-primary size-6" />
                    </span>
                    <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
                      {labelFor(selected, t)}
                    </ResponsiveModalTitle>
                    <ResponsiveModalDescription className="text-muted-foreground text-sm">
                      {t("on", {
                        date: formatDate(selected.createdAt, { locale }),
                      })}
                    </ResponsiveModalDescription>
                    <div
                      className={`font-display mt-3 text-5xl font-semibold tabular-nums ${
                        negative
                          ? "text-red-600 dark:text-red-400"
                          : "text-primary"
                      }`}
                    >
                      {selected.points > 0
                        ? `+${selected.points}`
                        : selected.points}
                    </div>
                    {selected.kind === "purchase" &&
                    selected.priceCents != null ? (
                      <p className="text-muted-foreground mt-1 text-sm font-medium">
                        {t("detailPurchaseValue", {
                          value: format.number(selected.priceCents / 100, {
                            style: "currency",
                            currency: "COP",
                            maximumFractionDigits: 0,
                          }),
                        })}
                      </p>
                    ) : null}
                  </div>
                );
              })()
            : null}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

/** Friendly label per row from the structured fields (no string parsing). */
function labelFor(
  item: { kind: string; rewardName: string | null },
  t: (key: string, values?: Record<string, string>) => string,
): string {
  switch (item.kind) {
    case "purchase":
      return t("txPurchase");
    case "reward":
      return item.rewardName
        ? t("txRedeem", { reward: item.rewardName })
        : t("txRedeemGeneric");
    case "adjust":
      return t("txAdjust");
    default:
      return t("txOther");
  }
}

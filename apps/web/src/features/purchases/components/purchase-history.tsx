"use client";

import { formatDate } from "@loyalty/date";
import { DateRangePicker } from "@loyalty/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { parseAsString, useQueryStates } from "nuqs";
import { useEffect, useRef } from "react";

import { money } from "@/features/menu/components/product-card";
import { Link } from "@/i18n/navigation";
import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

import type { PurchaseListItem } from "../types";
import { PurchaseHistorySkeleton } from "./purchase-history-skeleton";

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
 * Full purchase history (`purchases.myPurchases`) — an infinite list of every
 * purchase grouped by day, with an optional from/to date-range filter (nuqs).
 * Each row links to the intercepting `/compras/[id]` detail. Client component.
 */
export function PurchaseHistory() {
  const t = useTranslations("Purchases");
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

      <PurchaseHistoryList
        from={toIso(range.from, false)}
        to={toIso(range.to, true)}
      />
    </div>
  );
}

type DayGroup = { label: string; items: PurchaseListItem[] };

/** Group the flat (createdAt-desc) list into day buckets, preserving order. */
function groupByDay(items: PurchaseListItem[], locale: string): DayGroup[] {
  const groups: DayGroup[] = [];
  const index = new Map<string, DayGroup>();
  for (const item of items) {
    const key = new Date(item.createdAt).toISOString().slice(0, 10);
    let group = index.get(key);
    if (!group) {
      group = {
        label: formatDate(item.createdAt, { locale, preset: "long" }),
        items: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

function PurchaseHistoryList({ from, to }: { from?: string; to?: string }) {
  const t = useTranslations("Purchases");
  const locale = useLocale();
  const fade = useFadeUp();
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

  if (query.isPending) return <PurchaseHistorySkeleton />;

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground rounded-3xl border border-dashed py-14 text-center">
        <div className="mb-2 text-4xl">🧾</div>
        <p className="text-sm">{t("empty")}</p>
      </div>
    );
  }

  const groups = groupByDay(items, locale);
  let row = 0;

  return (
    <>
      <style>{`@keyframes tw-fade-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}`}</style>
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g.label}>
            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-foreground text-xs font-extrabold tracking-wide">
                {g.label}
              </span>
              <span className="text-muted-foreground text-xs font-bold">
                {t("items", { count: g.items.length })}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {g.items.map((item) => (
                <PurchaseRow key={item.id} item={item} style={fade(row++)} />
              ))}
            </div>
          </section>
        ))}
      </div>
      {query.isFetchingNextPage ? (
        <p className="text-muted-foreground py-4 text-center text-sm font-semibold">
          {t("loadingMore")}
        </p>
      ) : null}
      <div ref={sentinelRef} aria-hidden className="h-px" />
    </>
  );
}

function PurchaseRow({
  item,
  style,
}: {
  item: PurchaseListItem;
  style: React.CSSProperties | undefined;
}) {
  const t = useTranslations("Purchases");
  const format = useFormatter();

  const summary =
    item.itemCount === 0
      ? t("amountOnly")
      : (item.itemSummary ?? t("amountOnly"));

  return (
    <Link
      href={{ pathname: "/compras/[id]", params: { id: item.id } }}
      style={style}
      className="bg-card flex w-full items-center gap-3 rounded-3xl p-3.5 text-left shadow-lg shadow-black/5 ring-1 ring-black/5 transition-transform active:scale-[0.99] dark:ring-white/10"
    >
      <span className="grid size-[3.125rem] flex-none place-items-center rounded-2xl bg-gradient-to-br from-[#f1fffb] to-[#d6f6ed] text-2xl">
        🧋
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-foreground truncate text-[0.95rem] font-bold">
          {summary}
        </span>
        <div className="mt-1 flex gap-1.5">
          <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-extrabold">
            +{item.pointsEarned} pts
          </span>
          <span className="bg-primary/10 inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.6875rem] font-extrabold text-[#3f7d72]">
            🧋 +{item.stampsEarned}
          </span>
        </div>
      </div>
      <div className="flex flex-none flex-col items-end gap-0.5">
        <span className="font-display text-foreground text-lg font-semibold">
          {money(format, item.totalCents, item.currency)}
        </span>
        <ChevronRight className="text-muted-foreground/50 size-4" />
      </div>
    </Link>
  );
}

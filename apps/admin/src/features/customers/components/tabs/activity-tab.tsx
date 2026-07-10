"use client";

import type { TimelineEvent, TimelineKind } from "@loyalty/api/features/customers/schemas";
import { formatDate } from "@loyalty/date";
import { Skeleton } from "@loyalty/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Coins,
  Gift,
  MessageSquare,
  Receipt,
  ShieldAlert,
  Stamp,
  TrendingUp,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { useInfiniteSentinel } from "@/features/customers/hooks/use-infinite-sentinel";
import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

const ICONS: Record<TimelineKind, typeof Coins> = {
  purchase: Receipt,
  redeem: Gift,
  points: Coins,
  stamp: Stamp,
  tier: TrendingUp,
  message: MessageSquare,
  admin: ShieldAlert,
};

/** Unified feed: purchases, redemptions, ledger moves, tier changes, outbound
 *  messages and admin actions, newest first. Cursor-paginated. */
export function ActivityTab({ customerId }: { customerId: string }) {
  const t = useTranslations("Customers");
  const trpc = useTRPC();

  const query = useInfiniteQuery(
    trpc.customers.timeline.infiniteQueryOptions(
      { customerId, limit: 20 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    ),
  );
  const sentinelRef = useInfiniteSentinel(query);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  if (query.isPending) {
    return (
      <div className="bg-card border-border space-y-4 rounded-2xl border p-5 shadow-sm">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-9 flex-none rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-card border-border text-muted-foreground grid h-40 place-items-center rounded-2xl border text-sm shadow-sm">
        {t("timeline.empty")}
      </div>
    );
  }

  return (
    <div className="bg-card border-border rounded-2xl border p-5 shadow-sm">
      <ul className="divide-border divide-y">
        {items.map((e) => (
          <TimelineRow key={`${e.kind}-${e.id}`} event={e} />
        ))}
      </ul>
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {query.isFetchingNextPage ? (
        <p className="text-muted-foreground pt-4 text-center text-xs">{t("timeline.loading")}</p>
      ) : null}
    </div>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }) {
  const locale = useLocale();
  const Icon = ICONS[event.kind];

  const positive = (event.amount ?? 0) > 0;
  const amount = event.amount == null ? null : `${positive ? "+" : ""}${event.amount}`;

  const body = (
    <>
      <span
        className={`grid size-9 flex-none place-items-center rounded-xl ${
          event.negative ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
        }`}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className={`truncate text-sm font-bold ${event.negative ? "line-through" : ""}`}>
          {event.title}
        </div>
        <div className="text-muted-foreground/70 truncate text-xs font-semibold">
          {formatDate(event.at, { locale })}
          {event.detail ? ` · ${event.detail}` : ""}
        </div>
      </div>
      {amount ? (
        <span
          className={`text-sm font-extrabold whitespace-nowrap ${
            positive ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {amount}
        </span>
      ) : null}
    </>
  );

  // Purchases are the only navigable event today.
  if (event.kind === "purchase" && event.refId) {
    return (
      <li>
        <Link
          href={{ pathname: "/purchases/[id]", params: { id: event.refId } }}
          className="hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors"
        >
          {body}
        </Link>
      </li>
    );
  }

  return <li className="flex items-center gap-3 py-2.5">{body}</li>;
}

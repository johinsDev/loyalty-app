"use client";

import { formatDate } from "@loyalty/date";
import { Button, Skeleton } from "@loyalty/ui";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Coins, Gift, Pencil, Stamp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { useInfiniteSentinel } from "@/features/customers/hooks/use-infinite-sentinel";
import { useHasRole } from "@/lib/role-context";
import { useTRPC } from "@/lib/trpc/client";

import { AdjustLoyaltyDialog } from "../dialogs/adjust-loyalty-dialog";

export function LoyaltyTab({ customerId }: { customerId: string }) {
  const t = useTranslations("Customers");
  const trpc = useTRPC();
  const isOwner = useHasRole("owner");
  const [stampsOpen, setStampsOpen] = useState(false);
  const [pointsOpen, setPointsOpen] = useState(false);

  const points = useQuery(trpc.points.summaryForCustomer.queryOptions({ customerId }));
  const wallet = useQuery(trpc.stamps.walletForCustomer.queryOptions({ customerId }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <BalanceCard
          icon={Stamp}
          label={t("ledger.stampsBalanceLabel")}
          value={
            wallet.data ? `${wallet.data.currentStamps}/${wallet.data.stampsGoal}` : undefined
          }
          action={
            isOwner ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl"
                onClick={() => setStampsOpen(true)}
              >
                <Pencil className="size-3.5" />
                {t("adjust.stamps")}
              </Button>
            ) : null
          }
        />
        <BalanceCard
          icon={Coins}
          label={t("ledger.pointsBalanceLabel")}
          value={points.data ? points.data.balance.toLocaleString() : undefined}
          action={
            isOwner ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl"
                onClick={() => setPointsOpen(true)}
              >
                <Pencil className="size-3.5" />
                {t("adjust.points")}
              </Button>
            ) : null
          }
        />
      </div>

      <PointsLedger customerId={customerId} />
      <StampsLedger customerId={customerId} />
      <RedemptionsLedger customerId={customerId} />

      {isOwner ? (
        <>
          <AdjustLoyaltyDialog
            customerId={customerId}
            currency="stamps"
            open={stampsOpen}
            onOpenChange={setStampsOpen}
          />
          <AdjustLoyaltyDialog
            customerId={customerId}
            currency="points"
            open={pointsOpen}
            onOpenChange={setPointsOpen}
          />
        </>
      ) : null}
    </div>
  );
}

function BalanceCard({
  icon: Icon,
  label,
  value,
  action,
}: {
  icon: typeof Coins;
  label: string;
  value: string | undefined;
  action: ReactNode;
}) {
  return (
    <div className="bg-card border-border flex items-center gap-4 rounded-2xl border p-5 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="text-muted-foreground/70 flex items-center gap-1.5 text-xs font-extrabold tracking-wider uppercase">
          <Icon className="size-3.5" />
          {label}
        </div>
        {value === undefined ? (
          <Skeleton className="mt-2 h-8 w-20" />
        ) : (
          <div className="font-display mt-1 text-3xl font-semibold tracking-tight">{value}</div>
        )}
      </div>
      {action}
    </div>
  );
}

function PointsLedger({ customerId }: { customerId: string }) {
  const t = useTranslations("Customers");
  const locale = useLocale();
  const trpc = useTRPC();

  const query = useInfiniteQuery(
    trpc.customers.pointsLedger.infiniteQueryOptions(
      { customerId, limit: 20 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    ),
  );
  const sentinelRef = useInfiniteSentinel(query);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <LedgerSection
      title={t("ledger.points")}
      isPending={query.isPending}
      isEmpty={items.length === 0}
      sentinelRef={sentinelRef}
      isFetchingNextPage={query.isFetchingNextPage}
    >
      {items.map((row) => (
        <li key={row.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{t(`ledger.type.${row.type}`)}</div>
            <div className="text-muted-foreground/70 truncate text-xs font-semibold">
              {formatDate(row.createdAt, { locale })}
              {row.reason ? ` · ${row.reason}` : ""}
            </div>
          </div>
          <span
            className={`text-sm font-extrabold whitespace-nowrap ${
              row.points > 0 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {row.points > 0 ? "+" : ""}
            {row.points}
          </span>
        </li>
      ))}
    </LedgerSection>
  );
}

function StampsLedger({ customerId }: { customerId: string }) {
  const t = useTranslations("Customers");
  const locale = useLocale();
  const trpc = useTRPC();

  const query = useInfiniteQuery(
    trpc.customers.stampsHistory.infiniteQueryOptions(
      { customerId, limit: 20 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    ),
  );
  const sentinelRef = useInfiniteSentinel(query);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <LedgerSection
      title={t("ledger.stamps")}
      isPending={query.isPending}
      isEmpty={items.length === 0}
      sentinelRef={sentinelRef}
      isFetchingNextPage={query.isFetchingNextPage}
    >
      {items.map((row) => (
        <li key={row.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">
              {row.hasPurchase ? t("ledger.fromPurchase") : t("ledger.manualAdjust")}
            </div>
            <div className="text-muted-foreground/70 truncate text-xs font-semibold">
              {formatDate(row.createdAt, { locale })}
              {row.note ? ` · ${row.note}` : ""}
            </div>
          </div>
          <span
            className={`text-sm font-extrabold whitespace-nowrap ${
              row.amount > 0 ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {row.amount > 0 ? "+" : ""}
            {row.amount}
          </span>
        </li>
      ))}
    </LedgerSection>
  );
}

function RedemptionsLedger({ customerId }: { customerId: string }) {
  const t = useTranslations("Customers");
  const locale = useLocale();
  const trpc = useTRPC();

  const query = useInfiniteQuery(
    trpc.customers.redemptionsHistory.infiniteQueryOptions(
      { customerId, limit: 20 },
      { getNextPageParam: (last) => last.nextCursor ?? undefined },
    ),
  );
  const sentinelRef = useInfiniteSentinel(query);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <LedgerSection
      title={t("ledger.redemptions")}
      isPending={query.isPending}
      isEmpty={items.length === 0}
      sentinelRef={sentinelRef}
      isFetchingNextPage={query.isFetchingNextPage}
    >
      {items.map((row) => (
        <li key={row.id} className="flex items-center gap-3 py-2.5">
          <span className="bg-primary/10 text-primary grid size-9 flex-none place-items-center rounded-xl">
            <Gift className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold">{row.rewardName ?? "—"}</div>
            <div className="text-muted-foreground/70 truncate text-xs font-semibold">
              {formatDate(row.createdAt, { locale })}
            </div>
          </div>
          <span className="text-muted-foreground text-sm font-bold whitespace-nowrap">
            {row.currency === "stamps"
              ? t("ledger.spentStamps", { n: row.stampsSpent })
              : t("ledger.spentPoints", { n: row.pointsSpent })}
          </span>
        </li>
      ))}
    </LedgerSection>
  );
}

function LedgerSection({
  title,
  isPending,
  isEmpty,
  sentinelRef,
  isFetchingNextPage,
  children,
}: {
  title: string;
  isPending: boolean;
  isEmpty: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  isFetchingNextPage: boolean;
  children: ReactNode;
}) {
  const t = useTranslations("Customers");
  return (
    <section className="bg-card border-border rounded-2xl border p-5 shadow-sm">
      <h2 className="text-muted-foreground/70 mb-2 text-xs font-extrabold tracking-wider uppercase">
        {title}
      </h2>
      {isPending ? (
        <div className="space-y-3 py-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : isEmpty ? (
        <p className="text-muted-foreground py-6 text-center text-sm">{t("ledger.empty")}</p>
      ) : (
        <>
          <ul className="divide-border divide-y">{children}</ul>
          <div ref={sentinelRef} aria-hidden className="h-px" />
          {isFetchingNextPage ? (
            <p className="text-muted-foreground pt-3 text-center text-xs">
              {t("timeline.loading")}
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}

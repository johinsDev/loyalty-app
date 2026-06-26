"use client";

import { formatDate } from "@loyalty/date";
import { Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { CupSoda } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { money } from "@/features/menu/components/product-card";
import { Link } from "@/i18n/navigation";
import { useTRPC } from "@/lib/trpc/client";

/**
 * Recent visits — the customer's 3 most recent purchases, each linking to its
 * `/compras/[id]` detail, with a "see all" link to the full history. Renders
 * nothing when the customer has no purchases yet. Client component (reflects new
 * purchases as they land).
 */
export function RecentVisits() {
  const t = useTranslations("Home");
  const locale = useLocale();
  const format = useFormatter();
  const trpc = useTRPC();
  const { data, isPending } = useQuery(
    trpc.purchases.recentPurchases.queryOptions({ limit: 3 }),
  );

  if (isPending) {
    return (
      <section>
        <p className="text-muted-foreground mb-3 text-xs font-bold tracking-wider">
          {t("recentVisits")}
        </p>
        <div className="bg-card rounded-3xl px-4 py-1.5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              className="border-border flex items-center justify-between border-b py-3.5 last:border-0"
            >
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <section>
      <p className="text-muted-foreground mb-3 text-xs font-bold tracking-wider">
        {t("recentVisits")}
      </p>
      <div className="bg-card rounded-3xl px-4 py-1.5 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
        {data.map((p) => (
          <Link
            key={p.id}
            href={{ pathname: "/compras/[id]", params: { id: p.id } }}
            className="border-border flex items-center justify-between border-b py-3.5 last:border-0"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="bg-primary/10 text-primary grid size-9 flex-none place-items-center rounded-xl">
                <CupSoda className="size-4" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-foreground truncate text-sm font-semibold">
                  {money(format, p.totalCents, p.currency)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatDate(p.createdAt, { locale })}
                </span>
              </div>
            </div>
            <span className="text-primary shrink-0 text-sm font-bold">
              +{p.pointsEarned} pts
            </span>
          </Link>
        ))}
        <div className="flex justify-center py-3.5">
          <Link href="/compras" className="text-primary text-sm font-semibold">
            {t("seeAllHistory")}
          </Link>
        </div>
      </div>
    </section>
  );
}

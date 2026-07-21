"use client";

import { formatDate } from "@loyalty/date";
import { Badge, Skeleton } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Receipt } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/nav";
import { money } from "@/lib/money";
import { useTRPC } from "@/lib/trpc/client";

const RECENT = 10;

/** The customer's latest purchases. The full, filterable view lives in the
 *  purchases command center — `?customer=` deep-links straight to it. */
export function PurchasesTab({ customerId }: { customerId: string }) {
  const t = useTranslations("Customers");
  const locale = useLocale();
  const format = useFormatter();
  const trpc = useTRPC();

  const query = useQuery(
    trpc.purchases.adminList.queryOptions({
      customerIds: [customerId],
      page: 1,
      perPage: RECENT,
      sort: [],
    }),
  );
  const rows = query.data?.rows ?? [];

  if (query.isPending) {
    return (
      <div className="bg-card border-border space-y-3 rounded-2xl border p-5 shadow-sm">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-card border-border text-muted-foreground grid h-40 place-items-center rounded-2xl border text-sm shadow-sm">
        {t("purchasesTab.empty")}
      </div>
    );
  }

  return (
    <div className="bg-card border-border rounded-2xl border p-5 shadow-sm">
      <ul className="divide-border divide-y">
        {rows.map((p) => (
          <li key={p.id}>
            <Link
              href={{ pathname: "/purchases/[id]", params: { id: p.id } }}
              className="hover:bg-muted/40 -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors"
            >
              <span className="bg-primary/10 text-primary grid size-9 flex-none place-items-center rounded-xl">
                <Receipt className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className={`truncate text-sm font-bold ${p.voidedAt ? "line-through" : ""}`}
                >
                  {p.itemSummary ?? t("purchasesTab.items", { n: p.itemCount })}
                </div>
                <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                  {formatDate(p.createdAt, { locale })}
                  {p.storeName ? ` · ${p.storeName}` : ""}
                </div>
              </div>
              {p.voidedAt ? (
                <Badge variant="destructive">{t("purchasesTab.voided")}</Badge>
              ) : null}
              <span className="text-sm font-bold whitespace-nowrap">
                {money(format, p.totalCents, p.currency)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {(query.data?.total ?? 0) > RECENT ? (
        <Link
          href={{ pathname: "/purchases", query: { customer: customerId } }}
          className="text-primary mt-4 inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
        >
          {t("purchasesTab.viewAll")}
          <ArrowRight className="size-4" />
        </Link>
      ) : null}
    </div>
  );
}

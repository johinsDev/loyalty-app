"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import { useTRPC } from "@/lib/trpc/client";

/**
 * The purchase feed ("recent") — its own island, streamed + live-invalidated
 * independently of the wallet. Each row shows the purchase and the stamp it
 * granted.
 */
export function PurchaseHistory() {
  const t = useTranslations("Card");
  const format = useFormatter();
  const trpc = useTRPC();

  const { data } = useSuspenseQuery(
    trpc.sellos.myHistory.queryOptions({ page: 1, pageSize: 20 }),
  );

  return (
    <section className="bg-card border-border rounded-3xl border p-5 shadow-sm">
      <h2 className="font-display text-base font-semibold tracking-tight">
        {t("historyTitle")}
      </h2>
      {data.rows.length === 0 ? (
        <p className="text-muted-foreground mt-3 text-sm">{t("emptyHistory")}</p>
      ) : (
        <ul className="divide-border mt-2 divide-y">
          {data.rows.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-semibold">
                  {format.dateTime(p.createdAt, { dateStyle: "medium" })}
                </p>
                <p className="text-muted-foreground text-xs font-medium">
                  {format.number(p.priceCents / 100, {
                    style: "currency",
                    currency: "COP",
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <span className="text-primary text-sm font-extrabold">
                {t("purchaseStamp", { stamps: p.stamps })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

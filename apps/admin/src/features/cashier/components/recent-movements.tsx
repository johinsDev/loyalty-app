"use client";

import { useQuery } from "@tanstack/react-query";
import { Gift, Receipt } from "lucide-react";
import { useTranslations } from "next-intl";

import { useTRPC } from "@/lib/trpc/client";

import { useActiveStoreId } from "../use-active-store";

/**
 * Recent-movements panel — the right pane of the identify screen (T4 Caja
 * design). Today's purchases + redemptions at the active store, so the cashier
 * has live context while identifying the next socio. Wired to
 * `stamps.shiftPurchases`.
 */
export function RecentMovements() {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();
  const activeStoreId = useActiveStoreId();

  const feed = useQuery(
    trpc.stamps.shiftPurchases.queryOptions(
      { storeId: activeStoreId ?? "", limit: 8 },
      { enabled: Boolean(activeStoreId), refetchInterval: 30_000 },
    ),
  );
  const rows = feed.data ?? [];

  return (
    <div className="bg-card border-border rounded-3xl border p-5 shadow-sm">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-widest">
          {t("recentMovements")}
        </span>
        <span className="text-muted-foreground/70 text-xs font-semibold">{t("recentToday")}</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground/60 py-10 text-center text-sm font-semibold">
          {feed.isPending ? t("searching") : t("recentEmpty")}
        </p>
      ) : (
        <div className="flex flex-col">
          {rows.map((r) => {
            const redeem = r.stampsDelta < 0;
            return (
              <div
                key={r.id}
                className="border-border flex items-center gap-3 border-b py-3 last:border-0"
              >
                <span className="bg-muted text-muted-foreground grid size-10 flex-none place-items-center rounded-xl">
                  {redeem ? <Gift className="size-4" /> : <Receipt className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">
                    {r.customerName?.trim() || t("unknownCustomer")}
                  </div>
                  <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                    {r.items.length > 0 ? r.items.join(", ") : t("purchaseGeneric")}
                  </div>
                </div>
                <div className="flex-none text-right">
                  {r.stampsDelta !== 0 ? (
                    <div
                      className={`text-sm font-extrabold ${redeem ? "text-muted-foreground" : "text-primary"}`}
                    >
                      {r.stampsDelta > 0 ? `+${r.stampsDelta}` : r.stampsDelta}
                    </div>
                  ) : null}
                  <div className="text-muted-foreground/70 text-[0.6875rem] font-semibold">
                    {new Date(r.createdAt).toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

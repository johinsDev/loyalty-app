"use client";

import { useQuery } from "@tanstack/react-query";
import { Receipt, Store } from "lucide-react";
import { useTranslations } from "next-intl";

import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

import { useActiveStoreId } from "../use-active-store";

const formatCop = (cents: number): string =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

/**
 * Compras tab — the shift feed: today's purchases at the active store so the
 * cashier can confirm what was rung up. Lean (customer, time, items, stamps) —
 * not the full purchase detail. Live from `stamps.shiftPurchases`.
 */
export function PurchasesView() {
  const t = useTranslations("Cashier");
  const fade = useFadeUp();
  const trpc = useTRPC();
  const activeStoreId = useActiveStoreId();

  const feed = useQuery(
    trpc.stamps.shiftPurchases.queryOptions(
      { storeId: activeStoreId ?? "", limit: 50 },
      { enabled: Boolean(activeStoreId), refetchInterval: 30_000 },
    ),
  );
  const rows = feed.data ?? [];

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-5 lg:max-w-4xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight">{t("tabPurchases")}</h1>
      <p className="text-muted-foreground/70 mt-1 text-xs font-extrabold tracking-wider">
        {t("shiftFeedToday")}
      </p>

      {!activeStoreId ? (
        <Empty icon={<Store className="size-6" />} text={t("shiftFeedNoStore")} />
      ) : feed.isPending ? (
        <p className="text-muted-foreground py-16 text-center text-sm">{t("searching")}</p>
      ) : rows.length === 0 ? (
        <Empty icon={<Receipt className="size-6" />} text={t("shiftFeedEmpty")} />
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          {rows.map((r, i) => (
            <div
              key={r.id}
              style={fade(i)}
              className="border-border bg-card flex items-center gap-3 rounded-2xl border p-3.5 shadow-sm"
            >
              <span className="bg-muted text-muted-foreground grid size-11 flex-none place-items-center rounded-xl">
                <Receipt className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">
                  {r.items.length > 0 ? r.items.join(", ") : t("purchaseGeneric")}
                </div>
                <div className="text-muted-foreground/70 truncate text-xs font-semibold">
                  {(r.customerName?.trim() || t("unknownCustomer")) +
                    " · " +
                    new Date(r.createdAt).toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                </div>
              </div>
              <div className="flex-none text-right">
                {r.stampsDelta !== 0 ? (
                  <div
                    className={`text-sm font-extrabold ${r.stampsDelta < 0 ? "text-muted-foreground" : "text-primary"}`}
                  >
                    {r.stampsDelta > 0 ? `+${r.stampsDelta}` : r.stampsDelta}
                  </div>
                ) : null}
                <div className="text-muted-foreground/70 text-xs font-semibold">
                  {formatCop(r.netCents)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-muted-foreground/50 flex flex-col items-center gap-3 py-16 text-center">
      <span className="bg-muted grid size-14 place-items-center rounded-2xl">{icon}</span>
      <p className="text-muted-foreground text-sm font-semibold">{text}</p>
    </div>
  );
}

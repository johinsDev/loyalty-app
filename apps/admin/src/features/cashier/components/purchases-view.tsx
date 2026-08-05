"use client";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Receipt, Store } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { PurchaseDetailView } from "@/features/purchases/components/purchase-detail-view";
import { useFadeUp } from "@/lib/animate";
import { useTRPC } from "@/lib/trpc/client";

import { useCashierMoney } from "../format";
import { useActiveStoreId } from "../use-active-store";

import {
  CashierEmpty,
  CashierListSkeleton,
  CashierMedia,
  CashierPage,
  CashierRow,
} from "./chrome";

/**
 * Compras tab — the shift feed: today's purchases at the active store so the
 * cashier can confirm what was rung up. Lean (customer, time, items, stamps) —
 * not the full purchase detail. Live from `stamps.shiftPurchases`.
 */
export function PurchasesView() {
  const t = useTranslations("Cashier");
  const fade = useFadeUp();
  const trpc = useTRPC();
  const format = useFormatter();
  const money = useCashierMoney();
  const activeStoreId = useActiveStoreId();

  // Which sale the cashier opened. The feed row answers "was it rung up"; the
  // detail answers the question that follows — what was in it, which promo and
  // reward landed, what the customer earned.
  const [openId, setOpenId] = useState<string | null>(null);
  const detail = useQuery({
    ...trpc.purchases.adminGet.queryOptions({ id: openId ?? "" }),
    enabled: Boolean(openId),
  });

  const feed = useQuery(
    trpc.stamps.shiftPurchases.queryOptions(
      { storeId: activeStoreId ?? "", limit: 50 },
      { enabled: Boolean(activeStoreId), refetchInterval: 30_000 },
    ),
  );
  const rows = feed.data ?? [];

  return (
    <CashierPage title={t("tabPurchases")} subtitle={t("shiftFeedToday")}>
      {!activeStoreId ? (
        <CashierEmpty icon={<Store className="size-6" />} title={t("shiftFeedNoStore")} />
      ) : feed.isPending ? (
        <CashierListSkeleton />
      ) : rows.length === 0 ? (
        <CashierEmpty icon={<Receipt className="size-6" />} title={t("shiftFeedEmpty")} />
      ) : (
        <div className="mt-4 flex flex-col gap-2.5">
          {rows.map((r, i) => (
            <CashierRow
              key={r.id}
              style={fade(i)}
              onClick={() => setOpenId(r.id)}
              media={<CashierMedia icon={<Receipt className="size-5" />} />}
              title={r.items.length > 0 ? r.items.join(", ") : t("purchaseGeneric")}
              meta={
                (r.customerName?.trim() || t("unknownCustomer")) +
                " · " +
                format.dateTime(new Date(r.createdAt), {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              }
              trailing={
                <>
                  <div className="flex-none text-right">
                    {r.stampsDelta !== 0 ? (
                      <div
                        className={`text-sm font-extrabold ${r.stampsDelta < 0 ? "text-muted-foreground" : "text-primary"}`}
                      >
                        {r.stampsDelta > 0 ? `+${r.stampsDelta}` : r.stampsDelta}
                      </div>
                    ) : null}
                    <div className="text-muted-foreground/70 text-xs font-semibold">
                      {money(r.netCents)}
                    </div>
                  </div>
                  <ChevronRight className="text-muted-foreground/40 size-4 flex-none" />
                </>
              }
            />
          ))}
        </div>
      )}

      <ResponsiveModal open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <ResponsiveModalContent
          showCloseButton={false}
          mobileClassName="mx-auto w-full max-w-md"
          desktopClassName="sm:max-w-2xl"
        >
          <ResponsiveModalTitle className="sr-only">{t("tabPurchases")}</ResponsiveModalTitle>
          {openId && detail.data ? (
            // `cashier`, not `modal`: the same radiografía, minus the deep-links
            // that used to walk the cashier out of the register and into the CRM.
            <PurchaseDetailView detail={detail.data} variant="cashier" />
          ) : (
            <div className="p-5">
              <CashierListSkeleton count={4} />
            </div>
          )}
        </ResponsiveModalContent>
      </ResponsiveModal>
    </CashierPage>
  );
}

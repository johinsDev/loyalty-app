"use client";

import { Button } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import { useCashierMoney } from "../format";

import { CASHIER } from "./chrome";
import { RegisterBoard, type PreselectReward, type SaleResult } from "./register-board";
import { SaleSuccess } from "./sale-success";

/**
 * `/caja/cliente/[customerId]` — the register for one identified socio. Loads
 * the wallet + staff-safe context + claimable rewards, then the three-column
 * RegisterBoard. A reward scanned at identify time arrives as `preselect`.
 * Cancel / done return to `/caja`; scanning another reward routes back there too.
 */
export function RegisterView({
  customerId,
  preselect,
}: {
  customerId: string;
  preselect?: PreselectReward;
}) {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();
  const router = useRouter();
  const formatCop = useCashierMoney();

  const [success, setSuccess] = useState<SaleResult | null>(null);

  const wallet = useQuery(trpc.stamps.walletForCustomer.queryOptions({ customerId }));
  const register = useQuery(trpc.customers.registerContext.queryOptions({ customerId }));
  const available = useQuery(trpc.rewards.availableForCustomer.queryOptions({ customerId }));

  const backToIdentify = () => router.push("/register");

  // `replace`, not `push`: after a sale is recorded, leaving the charged
  // customer's register in the history means Back lands on it with an empty
  // cart — the shortest path to charging the same person twice.
  // `replace`, not `push`: leaving the charged customer's register in the
  // history means Back lands on it, which is the shortest path to a double sale.
  //
  // KNOWN BLOCKER (pre-existing, not caused by the modal): leaving
  // `/caja/cliente/[id]` doesn't commit. The history entry is pushed but the URL
  // never changes. Reproduced on a fresh dev server with `Cambiar cliente` and a
  // plain <Link> too, so it is the route, not this call. Consistent with the
  // tRPC batch bug where a failed query stays pending forever: an App Router
  // navigation runs in a transition, and a never-resolving suspense keeps it
  // from committing. Clearing the cart on success (see register-board) is what
  // actually defuses the double-charge in the meantime.
  const doneWithSale = () => {
    setSuccess(null);
    router.replace("/register");
  };

  // A failed wallet read used to sit on "Buscando…" forever, indistinguishable
  // from a slow one.
  if (wallet.isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-muted-foreground text-sm font-semibold">{t("walletError")}</p>
        <Button
          variant="outline"
          size="sm"
          className={CASHIER.control}
          onClick={() => void wallet.refetch()}
        >
          {t("retry")}
        </Button>
      </div>
    );
  }

  if (!wallet.data) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm font-semibold">
        {t("searching")}
      </div>
    );
  }

  const customerName =
    register.data?.name?.trim() || register.data?.phoneMasked || t("unknownCustomer");

  return (
    <>
      <RegisterBoard
        customerId={customerId}
        customerName={customerName}
        register={register.data}
        wallet={wallet.data}
        availableRewards={{
          items: available.data?.items ?? [],
          publishedCount: available.data?.publishedCount ?? 0,
          nextReward: available.data?.nextReward ?? null,
          isPending: available.isPending,
          isError: available.isError,
          refetch: () => void available.refetch(),
        }}
        preselect={preselect}
        onSuccess={(result) => setSuccess(result)}
        onRewardPending={backToIdentify}
        onCancel={backToIdentify}
        onScan={backToIdentify}
      />
      {success ? (
        <SaleSuccess
          open
          onClose={doneWithSale}
          totalCents={success.totalCents}
          earned={success.earned}
          pointsBalance={success.pointsBalance}
          tierUp={success.tierUp}
          formatMoney={formatCop}
        />
      ) : null}
    </>
  );
}

"use client";

import { Button, Spinner } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

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
  const [leaving, startLeaving] = useTransition();

  const wallet = useQuery(trpc.stamps.walletForCustomer.queryOptions({ customerId }));
  const register = useQuery(trpc.customers.registerContext.queryOptions({ customerId }));
  const available = useQuery(trpc.rewards.availableForCustomer.queryOptions({ customerId }));

  /**
   * Leave this customer's register.
   *
   * The socio is a URL segment, so leaving is a route change — and a route
   * change runs in a transition, which by design keeps the OLD screen on
   * until the new one is ready. That is what "Cambiar cliente no hace nada"
   * was: the push did fire and did commit (a few hundred ms on localhost,
   * longer on the shop's tablet against the Worker), but for that whole window
   * the register sat there unchanged — same customer, same name, same
   * balances, button not even depressed. So the cashier tapped it again.
   * Worse after a sale: the socio who just paid stayed on screen next to an
   * emptied cart, which is precisely the "charge them twice" shape the cart
   * clearing was added to defuse.
   *
   * Holding the transition ourselves lets the screen answer the tap on the
   * spot: `leaving` swaps the board for a neutral hand-off, so the previous
   * customer is gone the instant the cashier asks for it, and the navigation
   * commits underneath.
   *
   * `replace`, not `push`, in both cases: leaving a customer's register in the
   * history means Back lands on it with an empty cart, which is the shortest
   * path to charging the same person twice.
   */
  const leaveRegister = () => {
    setSuccess(null);
    startLeaving(() => router.replace("/register"));
  };

  // The hand-off. Drawn before every other branch — once the cashier has asked
  // to move on, nothing about the previous socio should still be on screen,
  // including a stale error or spinner from their queries.
  if (leaving) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
        <Spinner className="text-muted-foreground size-6" />
        <p className="text-muted-foreground text-sm font-semibold">{t("leavingRegister")}</p>
      </div>
    );
  }

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
        onRewardPending={leaveRegister}
        onCancel={leaveRegister}
        onScan={leaveRegister}
      />
      {success ? (
        <SaleSuccess
          open
          onClose={leaveRegister}
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

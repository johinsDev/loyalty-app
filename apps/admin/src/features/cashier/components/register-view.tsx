"use client";

import type { AppRouter } from "@loyalty/api";
import { Button } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import { RegisterBoard, type PreselectReward } from "./register-board";

type WalletView = inferRouterOutputs<AppRouter>["stamps"]["walletForCustomer"];

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

  const [success, setSuccess] = useState<WalletView | null>(null);

  const wallet = useQuery(trpc.stamps.walletForCustomer.queryOptions({ customerId }));
  const register = useQuery(trpc.customers.registerContext.queryOptions({ customerId }));
  const available = useQuery(trpc.rewards.availableForCustomer.queryOptions({ customerId }));

  const backToIdentify = () => router.push("/register");

  if (success) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3.5 px-5 py-10 text-center">
        <div className="from-primary to-primary/80 grid size-24 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-xl">
          <Check className="size-12" strokeWidth={3} />
        </div>
        <div className="font-display text-3xl font-semibold tracking-tight">
          {t("purchaseRecorded")}
        </div>
        <div className="bg-card border-border mt-1 rounded-2xl border p-4">
          <div className="text-muted-foreground/70 text-[0.6875rem] font-extrabold tracking-wider">
            {t("newBalance")}
          </div>
          <div className="text-lg font-extrabold">
            {success.currentStamps}/{success.walletSize} {t("stampMany")}
          </div>
        </div>
        <Button
          size="lg"
          onClick={backToIdentify}
          className="mt-3 h-10 w-full max-w-xs rounded-2xl text-base font-extrabold"
        >
          {t("nextMember")}
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
    <RegisterBoard
      customerId={customerId}
      customerName={customerName}
      register={register.data}
      wallet={wallet.data}
      availableRewards={available.data ?? []}
      preselect={preselect}
      onSuccess={(view) => setSuccess(view)}
      onRewardPending={backToIdentify}
      onCancel={backToIdentify}
      onScan={backToIdentify}
    />
  );
}

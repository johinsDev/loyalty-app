"use client";

import type { AppRouter } from "@loyalty/api";
import { Button } from "@loyalty/ui";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { Check, Hash, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import { CATALOG_STALE_MS } from "../catalog-cache";

import { IdentifyPane } from "./identify-pane";
import { QrScanner } from "./qr-scanner";

type ResolveClaim = inferRouterOutputs<AppRouter>["rewards"]["resolveClaim"];

/** QR prefixes the customer app renders for single-use claim tokens. */
const REWARD_PREFIX = "T4P|"; // stamps/points reward
const STREAK_PREFIX = "T4S|"; // streak reward

/**
 * `/caja` — the identify screen (its own URL; the register lives at
 * `/caja/cliente/[customerId]`). A centered card with two tabs: look a socio up
 * by phone (on-screen numpad) or scan their QR. A scanned reward QR routes to the
 * register with the reward preselected; a streak QR (`T4S|`) claims standalone.
 */
export function IdentifyView() {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Warm the store catalog so the register's first search is instant.
  useEffect(() => {
    void queryClient.prefetchQuery(
      trpc.menu.list.queryOptions({ pageSize: 20 }, { staleTime: CATALOG_STALE_MS }),
    );
  }, [queryClient, trpc]);

  const [tab, setTab] = useState<"phone" | "scan">("phone");
  const [claimed, setClaimed] = useState(false);
  const [pastedCode, setPastedCode] = useState("");

  const resolveClaim = useMutation(trpc.rewards.resolveClaim.mutationOptions());
  const claimStreak = useMutation(trpc.streaks.claimReward.mutationOptions());
  const isClaiming = resolveClaim.isPending || claimStreak.isPending;

  const goRegister = useCallback(
    (customerId: string, reward?: ResolveClaim) =>
      router.push({
        pathname: "/register/customer/[customerId]",
        params: { customerId },
        ...(reward
          ? {
              query: {
                rewardId: reward.reward.id,
                currency: reward.currency,
                rewardName: reward.reward.name,
                ...(reward.reward.fulfillmentNote ? { note: reward.reward.fulfillmentNote } : {}),
              },
            }
          : {}),
      }),
    [router],
  );

  const onScanResult = useCallback(
    async (text: string) => {
      const isStreak = text.startsWith(STREAK_PREFIX);
      const isReward = text.startsWith(REWARD_PREFIX);
      if (!isStreak && !isReward) {
        toast.error(t("notRewardCode"));
        return;
      }
      const token = text.slice(REWARD_PREFIX.length); // both prefixes are 4 chars
      try {
        if (isStreak) {
          await claimStreak.mutateAsync({ token });
          setClaimed(true);
          toast.success(t("claimValidated"));
        } else {
          const resolved = await resolveClaim.mutateAsync({ token });
          goRegister(resolved.customerId, resolved);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (msg === "ALREADY_CLAIMED") toast.error(t("alreadyClaimed"));
        else if (msg === "INSUFFICIENT_BALANCE") toast.error(t("insufficientBalance"));
        else toast.error(t("invalidToken"));
      }
    },
    [claimStreak, resolveClaim, goRegister, t],
  );

  if (claimed) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3.5 px-5 py-10 text-center">
        <div className="from-primary to-primary/80 grid size-24 place-items-center rounded-3xl bg-gradient-to-br text-white shadow-xl">
          <Check className="size-12" strokeWidth={3} />
        </div>
        <div className="font-display text-3xl font-semibold tracking-tight">
          {t("claimValidated")}
        </div>
        <div className="text-muted-foreground text-base">{t("handRewardToCustomer")}</div>
        <Button
          size="lg"
          onClick={() => setClaimed(false)}
          className="mt-3 h-10 w-full max-w-xs rounded-2xl text-base font-extrabold"
        >
          {t("done")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-5 py-6">
      <div className="mb-5 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("identifyTitle")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("identifyTabsHint")}</p>
      </div>

      <div className="bg-card border-border rounded-3xl border p-5 shadow-sm">
        {/* Tab toggle. */}
        <div className="bg-muted mb-5 grid grid-cols-2 gap-1 rounded-2xl p-1">
          {(
            [
              { id: "phone" as const, label: t("byNumberTab"), icon: Hash },
              { id: "scan" as const, label: t("byQrTab"), icon: QrCode },
            ]
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-extrabold transition ${
                tab === id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>

        {tab === "phone" ? (
          <IdentifyPane onSelect={(hit) => goRegister(hit.id)} />
        ) : (
          <div>
            <p className="text-muted-foreground text-center text-sm">{t("scanRedeemHint")}</p>
            <QrScanner
              caption={t("aimCameraReward")}
              permissionError={t("cameraError")}
              onResult={(text) => void onScanResult(text)}
            />
            {isClaiming ? (
              <div className="text-muted-foreground text-center text-sm font-semibold">
                {t("validating")}
              </div>
            ) : null}
            <div className="border-border mt-4 border-t pt-4">
              <label className="text-muted-foreground/70 mb-1.5 block text-[0.6875rem] font-extrabold tracking-wider">
                {t("pasteCodeLabel")}
              </label>
              <div className="flex gap-2">
                <input
                  value={pastedCode}
                  onChange={(e) => setPastedCode(e.target.value)}
                  placeholder={t("pasteCodePlaceholder")}
                  className="border-border bg-muted placeholder:text-muted-foreground/70 h-10 w-full rounded-2xl border px-3.5 text-sm font-semibold outline-none"
                />
                <Button
                  size="lg"
                  disabled={pastedCode.trim().length === 0 || isClaiming}
                  onClick={() => void onScanResult(pastedCode.trim())}
                  className="h-10 flex-none rounded-2xl px-4 font-extrabold"
                >
                  {t("pasteCodeCta")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

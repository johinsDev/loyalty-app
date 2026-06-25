"use client";

import type { AppRouter } from "@loyalty/api";
import { Button } from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useDebounce } from "ahooks";
import { Check, Minus, Plus, Search, Tag, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

type WalletView = inferRouterOutputs<AppRouter>["stamps"]["walletForCustomer"];

type CartItem = {
  productId: string;
  name: string;
  unitAmountCents: number;
  qty: number;
};

const CURRENCY = "COP";

function formatCop(cents: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);
}

function isRewardPending(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: string; data?: { code?: string } };
  return e.data?.code === "CONFLICT" && e.message === "REWARD_PENDING";
}

/**
 * Itemized checkout panel: build a cart from the menu, see the promos the
 * customer can apply (discount computed server-side via `promociones.applicable`),
 * pick one (max 1 unless stackable — enforced by the cashier here), and record
 * the purchase. The discount is re-computed on the server at record time, so the
 * client's number is only a preview.
 */
export function ItemizedPurchase({
  customerId,
  onSuccess,
  onRewardPending,
}: {
  customerId: string;
  onSuccess: (wallet: WalletView) => void;
  onRewardPending: () => void;
}) {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();

  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [chosenPromoId, setChosenPromoId] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query.trim(), { wait: 250 });
  const menu = useQuery(
    trpc.menu.list.queryOptions({ search: debouncedQuery || undefined, pageSize: 20 }),
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.unitAmountCents * i.qty, 0),
    [cart],
  );

  const cartInput = useMemo(
    () => ({
      currency: CURRENCY,
      lines: cart.map((i) => ({
        productId: i.productId,
        qty: i.qty,
        unitAmountCents: i.unitAmountCents,
      })),
    }),
    [cart],
  );

  const applicable = useQuery(
    trpc.promociones.applicable.queryOptions(
      { customerId, cart: cartInput },
      { enabled: cart.length > 0 },
    ),
  );
  const promos = applicable.data ?? [];

  // Auto-apply the best promo (max discount, then best points) whenever the
  // applicable set changes, so the total always shows the final charge. The
  // cashier can still pick a different one or deselect (until the cart changes).
  useEffect(() => {
    const list = applicable.data ?? [];
    if (list.length === 0) {
      setChosenPromoId(null);
      return;
    }
    const best = [...list].sort(
      (a, b) => b.discountCents - a.discountCents || b.pointsMultiplier - a.pointsMultiplier,
    )[0];
    setChosenPromoId(best?.promo.id ?? null);
  }, [applicable.data]);

  const chosen = promos.find((p) => p.promo.id === chosenPromoId) ?? null;
  const discount = chosen?.discountCents ?? 0;
  const net = Math.max(0, subtotal - discount);

  const recordPurchase = useMutation(trpc.stamps.recordPurchase.mutationOptions());

  const addProduct = (p: { id: string; name: string; priceCents: number }) => {
    setCart((c) => {
      const existing = c.find((i) => i.productId === p.id);
      if (existing)
        return c.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...c, { productId: p.id, name: p.name, unitAmountCents: p.priceCents, qty: 1 }];
    });
  };

  const bump = (productId: string, delta: number) => {
    setCart((c) =>
      c
        .map((i) => (i.productId === productId ? { ...i, qty: i.qty + delta } : i))
        .filter((i) => i.qty > 0),
    );
  };

  const removeLine = (productId: string) => {
    setCart((c) => c.filter((i) => i.productId !== productId));
  };

  const onRecord = async () => {
    if (cart.length === 0) return;
    try {
      const view = await recordPurchase.mutateAsync({
        customerId,
        priceCents: subtotal,
        idempotencyKey: crypto.randomUUID(),
        items: cart.map((i) => ({
          productId: i.productId,
          qty: i.qty,
          unitAmountCents: i.unitAmountCents,
        })),
        appliedPromoId: chosenPromoId ?? undefined,
        currency: CURRENCY,
      });
      onSuccess(view);
      toast.success(t("purchaseRecorded"));
    } catch (err) {
      if (isRewardPending(err)) {
        toast.error(t("rewardPendingToast"));
        onRewardPending();
        return;
      }
      if (err instanceof Error && err.message === "PROMO_NOT_APPLICABLE") {
        toast.error(t("promoNotApplicable"));
        setChosenPromoId(null);
        void applicable.refetch();
        return;
      }
      toast.error(err instanceof Error ? err.message : t("purchaseError"));
    }
  };

  return (
    <div className="space-y-4">
      {/* Product search */}
      <div>
        <div className="border-border bg-muted flex h-10 items-center gap-2 rounded-2xl border px-3.5">
          <Search className="text-muted-foreground/70 size-4" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("productSearch")}
            className="placeholder:text-muted-foreground/70 w-full bg-transparent text-sm font-semibold outline-none"
          />
        </div>
        {menu.data && menu.data.items.length > 0 ? (
          <div className="border-border mt-2 max-h-48 divide-y overflow-y-auto rounded-2xl border">
            {menu.data.items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct({ id: p.id, name: p.name, priceCents: p.priceCents })}
                className="hover:bg-muted flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
              >
                <span className="truncate text-sm font-semibold">{p.name}</span>
                <span className="text-muted-foreground flex items-center gap-2 text-xs font-bold">
                  {formatCop(p.priceCents)}
                  <Plus className="text-primary size-4" />
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Cart */}
      {cart.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm font-semibold">
          {t("cartEmpty")}
        </p>
      ) : (
        <div className="space-y-2">
          {cart.map((i) => (
            <div
              key={i.productId}
              className="border-border flex items-center gap-3 rounded-2xl border p-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold">{i.name}</div>
                <div className="text-muted-foreground text-xs font-semibold">
                  {formatCop(i.unitAmountCents)}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => bump(i.productId, -1)}
                  className="border-border grid size-7 place-items-center rounded-lg border"
                  aria-label={t("decrease")}
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="w-5 text-center text-sm font-bold">{i.qty}</span>
                <button
                  type="button"
                  onClick={() => bump(i.productId, 1)}
                  className="border-border grid size-7 place-items-center rounded-lg border"
                  aria-label={t("increase")}
                >
                  <Plus className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeLine(i.productId)}
                  className="text-muted-foreground hover:text-destructive grid size-7 place-items-center rounded-lg"
                  aria-label={t("removeLine")}
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Applicable promos */}
      {cart.length > 0 ? (
        <div className="border-border rounded-2xl border p-3.5">
          <div className="flex items-center gap-2">
            <Tag className="text-muted-foreground size-4" />
            <h3 className="text-sm font-bold">{t("applicablePromos")}</h3>
          </div>
          {applicable.isPending ? (
            <p className="text-muted-foreground mt-2 text-xs">{t("searching")}</p>
          ) : promos.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-xs">{t("noPromos")}</p>
          ) : (
            <div className="mt-2 space-y-1.5">
              {promos.map((ap) => {
                const active = ap.promo.id === chosenPromoId;
                return (
                  <button
                    key={ap.promo.id}
                    type="button"
                    onClick={() => setChosenPromoId(active ? null : ap.promo.id)}
                    className={
                      active
                        ? "border-primary bg-primary/5 flex w-full items-center justify-between gap-3 rounded-xl border-2 p-2.5 text-left"
                        : "border-border flex w-full items-center justify-between gap-3 rounded-xl border p-2.5 text-left"
                    }
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-bold">{ap.promo.name}</div>
                      <div className="text-muted-foreground text-xs font-semibold">
                        {ap.discountCents > 0
                          ? `− ${formatCop(ap.discountCents)}`
                          : ap.pointsMultiplier > 1
                            ? t("pointsMultiplier", { x: ap.pointsMultiplier })
                            : ""}
                      </div>
                    </div>
                    {active ? <Check className="text-primary size-5 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : null}

      {/* Totals */}
      {cart.length > 0 ? (
        <div className="bg-muted space-y-1.5 rounded-2xl p-3.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-semibold">{t("subtotal")}</span>
            <span className="font-bold">{formatCop(subtotal)}</span>
          </div>
          {discount > 0 ? (
            <div className="text-primary flex items-center justify-between">
              <span className="font-semibold">{t("discount")}</span>
              <span className="font-bold">− {formatCop(discount)}</span>
            </div>
          ) : null}
          <div className="border-border flex items-center justify-between border-t pt-1.5">
            <span className="font-bold">{t("net")}</span>
            <span className="font-display text-lg font-semibold">{formatCop(net)}</span>
          </div>
        </div>
      ) : null}

      <Button
        variant="gradient"
        size="lg"
        disabled={cart.length === 0 || recordPurchase.isPending}
        onClick={() => void onRecord()}
        className="h-10 w-full gap-2 rounded-2xl text-base font-extrabold"
      >
        <Check className="size-5" />
        {t("recordPurchase")}
      </Button>
    </div>
  );
}

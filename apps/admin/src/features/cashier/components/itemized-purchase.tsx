"use client";

import type { AppRouter } from "@loyalty/api";
import { Button } from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useDebounce } from "ahooks";
import { ArrowUp, Check, Gift, Lightbulb, Minus, Plus, Search, Tag, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

import { CATALOG_STALE_MS } from "../catalog-cache";
import { useActiveStoreId } from "../use-active-store";

import { ProductPicker, type PickedLine } from "./product-picker";
import { StorelessConfirm } from "./storeless-confirm";

type WalletView = inferRouterOutputs<AppRouter>["stamps"]["walletForCustomer"];

type AvailableReward =
  inferRouterOutputs<AppRouter>["rewards"]["availableForCustomer"][number];

/** Map the reward's affordable currencies to the inline-redeem currency the
 *  purchase mutation expects. An "and" reward (both required) is paid as "both";
 *  otherwise prefer stamps, fall back to points. */
function inlineRewardCurrency(rw: AvailableReward): "stamps" | "points" | "both" {
  if (rw.costMode === "and") return "both";
  if (rw.affordableWith.includes("stamps")) return "stamps";
  if (rw.affordableWith.includes("points")) return "points";
  return "stamps";
}

type CartItem = {
  /** Stable per-line id — same product/variant can appear twice with different
   *  notes, so lines are keyed individually, not merged by product. */
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  unitAmountCents: number;
  qty: number;
  note: string;
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
/** A reward preselected upstream (scanned QR / entered code) — carries the exact
 *  currency the customer chose on their phone, which the register must honor. */
export type PreselectReward = {
  rewardId: string;
  currency: "stamps" | "points" | "both";
  name: string;
  /** Staff fulfillment note (experience rewards) — shown prominently so the
   *  cashier knows what to hand over / do. */
  note?: string | null;
};

export function ItemizedPurchase({
  customerId,
  onSuccess,
  onRewardPending,
  preselect,
}: {
  customerId: string;
  onSuccess: (wallet: WalletView) => void;
  onRewardPending: () => void;
  /** When the sale was opened from a scanned/entered reward claim, that reward
   *  is preselected here (its units drive the discount preview + redemption). */
  preselect?: PreselectReward;
}) {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();

  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNote, setOrderNote] = useState("");
  // Which line note inputs are revealed (kept collapsed until asked, so the
  // ticket stays clean).
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  // The product tapped in search, pending variant/note selection in the picker.
  const [picker, setPicker] = useState<{ slug: string; name: string; priceCents: number } | null>(
    null,
  );
  const [chosenPromoId, setChosenPromoId] = useState<string | null>(null);
  const [inlineRewardId, setInlineRewardId] = useState<string | null>(
    preselect?.rewardId ?? null,
  );

  const debouncedQuery = useDebounce(query.trim(), { wait: 250 });
  // The catalog is shift-stable — cache it long so search stays instant on flaky
  // wifi (the shift prefetch on register mount warms the base list).
  const menu = useQuery(
    trpc.menu.list.queryOptions(
      { search: debouncedQuery || undefined, pageSize: 20 },
      { staleTime: CATALOG_STALE_MS },
    ),
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.unitAmountCents * i.qty, 0),
    [cart],
  );

  // Rewards this customer can redeem right now — offered as an optional inline
  // redemption folded into this same sale (deducted in the purchase tx).
  const availableRewards = useQuery(
    trpc.rewards.availableForCustomer.queryOptions({ customerId }),
  );
  const rewards = availableRewards.data ?? [];
  const chosenReward = rewards.find((r) => r.rewardId === inlineRewardId) ?? null;

  // The currency to redeem with: the preselected one (customer's phone choice)
  // wins; otherwise derive it from the reward's affordable currencies.
  const activeRewardCurrency: "stamps" | "points" | "both" | null =
    inlineRewardId == null
      ? null
      : inlineRewardId === preselect?.rewardId
        ? preselect.currency
        : chosenReward
          ? inlineRewardCurrency(chosenReward)
          : null;
  const activeRewardName =
    chosenReward?.name ??
    (inlineRewardId === preselect?.rewardId ? preselect?.name : undefined);
  const inlineReward =
    inlineRewardId != null && activeRewardCurrency != null
      ? { rewardId: inlineRewardId, currency: activeRewardCurrency }
      : undefined;

  // Preview mirrors recordPurchase: reward first (its units excluded), promos on
  // the remainder — so the shown total equals the charge.
  const preview = useQuery(
    trpc.stamps.preview.queryOptions(
      {
        customerId,
        currency: CURRENCY,
        items: cart.map((i) => ({
          productId: i.productId,
          variantId: i.variantId ?? undefined,
          qty: i.qty,
          unitAmountCents: i.unitAmountCents,
        })),
        inlineReward,
      },
      { enabled: cart.length > 0 },
    ),
  );
  const promos = preview.data?.applicable ?? [];
  const upsell = preview.data?.upsell ?? [];
  const rewardPreview = preview.data?.reward ?? null;

  // Auto-apply the best promo whenever the applicable set changes, so the
  // total always shows the final charge. The server sorts best-first
  // (discount desc, then multiplier), so the first entry is the best. The
  // cashier can still pick a different one or deselect (until the cart changes).
  useEffect(() => {
    const list = preview.data?.applicable ?? [];
    setChosenPromoId(list[0]?.promo.id ?? null);
  }, [preview.data]);

  const chosen = promos.find((p) => p.promo.id === chosenPromoId) ?? null;
  const promoDiscount = chosen?.discountCents ?? 0;
  const rewardDiscount = rewardPreview?.ok ? rewardPreview.discountCents : 0;
  const net = Math.max(0, subtotal - promoDiscount - rewardDiscount);

  const recordPurchase = useMutation(trpc.stamps.recordPurchase.mutationOptions());
  const activeStoreId = useActiveStoreId();
  // "Facturar sin tienda" confirm: recording without an active store is allowed
  // but must be explicit (see StorelessConfirm).
  const [storelessOpen, setStorelessOpen] = useState(false);

  const addLine = (line: PickedLine) => {
    setCart((c) => [
      ...c,
      {
        key: crypto.randomUUID(),
        productId: line.productId,
        variantId: line.variantId,
        name: line.name,
        unitAmountCents: line.unitAmountCents,
        qty: 1,
        note: line.note,
      },
    ]);
    setPicker(null);
  };

  const bump = (key: string, delta: number) => {
    setCart((c) =>
      c.map((i) => (i.key === key ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0),
    );
  };

  const removeLine = (key: string) => {
    setCart((c) => c.filter((i) => i.key !== key));
  };

  const setLineNote = (key: string, note: string) => {
    setCart((c) => c.map((i) => (i.key === key ? { ...i, note } : i)));
  };

  const openNote = (key: string) => setOpenNotes((s) => new Set(s).add(key));

  const cartCount = cart.reduce((n, i) => n + i.qty, 0);

  // Human copy for one upsell nudge (add-item / spend-to-threshold / swap).
  const upsellText = (u: (typeof upsell)[number]): string => {
    switch (u.kind) {
      case "add-item":
        return t("upsellAddItem", { promo: u.promo.name });
      case "spend-to-threshold":
        return t("upsellSpend", { amount: formatCop(u.addCents), promo: u.promo.name });
      case "variant-swap":
        return t("upsellSwap", {
          extra: formatCop(u.extraCents),
          discount: formatCop(u.discountCents),
          promo: u.promo.name,
        });
    }
  };

  // Guard the sale on a missing store, then submit.
  const onRecord = () => {
    if (cart.length === 0) return;
    if (!activeStoreId) {
      setStorelessOpen(true);
      return;
    }
    void submit();
  };

  const submit = async () => {
    if (cart.length === 0) return;
    setStorelessOpen(false);
    try {
      const view = await recordPurchase.mutateAsync({
        customerId,
        storeId: activeStoreId ?? undefined,
        priceCents: subtotal,
        idempotencyKey: crypto.randomUUID(),
        items: cart.map((i) => ({
          productId: i.productId,
          variantId: i.variantId ?? undefined,
          qty: i.qty,
          unitAmountCents: i.unitAmountCents,
          note: i.note || undefined,
        })),
        orderNote: orderNote.trim() || undefined,
        appliedPromoId: chosenPromoId ?? undefined,
        inlineReward,
        currency: CURRENCY,
      });
      onSuccess(view);
      setInlineRewardId(null);
      toast.success(t("purchaseRecorded"));
    } catch (err) {
      if (isRewardPending(err)) {
        toast.error(t("rewardPendingToast"));
        onRewardPending();
        return;
      }
      if (err instanceof Error && err.message === "reward-not-redeemable") {
        toast.error(t("inlineRewardError"));
        setInlineRewardId(null);
        void availableRewards.refetch();
        void preview.refetch();
        return;
      }
      if (err instanceof Error && err.message === "PROMO_NOT_APPLICABLE") {
        toast.error(t("promoNotApplicable"));
        setChosenPromoId(null);
        void preview.refetch();
        return;
      }
      toast.error(err instanceof Error ? err.message : t("purchaseError"));
    }
  };

  return (
    <>
      <div className="lg:grid lg:grid-cols-[1fr_minmax(320px,380px)] lg:items-start lg:gap-5">
        {/* LEFT — catalog: search the menu, tap to add a line */}
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
                onClick={() => setPicker({ slug: p.slug, name: p.name, priceCents: p.priceCents })}
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
        </div>

        {/* RIGHT — the live ticket, always visible on tablet/desktop */}
        <div className="mt-4 space-y-4 lg:mt-0 lg:sticky lg:top-4">
          {/* Cart */}
          {cart.length === 0 ? (
            <div className="border-border rounded-2xl border border-dashed py-10 text-center">
              <p className="text-muted-foreground text-sm font-semibold">{t("cartEmpty")}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-muted-foreground px-1 text-[0.6875rem] font-extrabold tracking-wider">
                {t("ticketHeading", { count: cartCount })}
              </div>
              {cart.map((i) => {
                const noteShown = openNotes.has(i.key) || i.note.length > 0;
                return (
                  <div key={i.key} className="border-border rounded-2xl border p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 truncate text-sm font-bold">{i.name}</div>
                      <div className="flex-none text-sm font-extrabold">
                        {formatCop(i.unitAmountCents * i.qty)}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-muted-foreground text-xs font-semibold">
                        {i.qty} × {formatCop(i.unitAmountCents)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => bump(i.key, -1)}
                          className="border-border grid size-7 place-items-center rounded-lg border"
                          aria-label={t("decrease")}
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-5 text-center text-sm font-bold">{i.qty}</span>
                        <button
                          type="button"
                          onClick={() => bump(i.key, 1)}
                          className="border-border grid size-7 place-items-center rounded-lg border"
                          aria-label={t("increase")}
                        >
                          <Plus className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeLine(i.key)}
                          className="text-muted-foreground hover:text-destructive grid size-7 place-items-center rounded-lg"
                          aria-label={t("removeLine")}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                    {/* Line note — collapsed until asked, so the ticket stays clean. */}
                    {noteShown ? (
                      <input
                        value={i.note}
                        onChange={(e) => setLineNote(i.key, e.target.value)}
                        placeholder={t("lineNotePlaceholder")}
                        className="border-border/60 bg-muted/40 placeholder:text-muted-foreground/60 mt-2.5 h-8 w-full rounded-lg border px-2.5 text-xs font-semibold outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => openNote(i.key)}
                        className="text-muted-foreground hover:text-foreground mt-2 inline-flex items-center gap-1 text-xs font-bold"
                      >
                        <Plus className="size-3.5" />
                        {t("addNote")}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Applicable promos */}
          {cart.length > 0 ? (
            <div className="border-border rounded-2xl border p-3.5">
              <div className="flex items-center gap-2">
                <Tag className="text-muted-foreground size-4" />
                <h3 className="text-sm font-bold">{t("applicablePromos")}</h3>
              </div>
              {preview.isPending ? (
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
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-bold">{ap.promo.name}</span>
                            {ap.applications > 1 ? (
                              <span className="bg-primary/10 text-primary shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold">
                                {t("promoApplications", { count: ap.applications })}
                              </span>
                            ) : null}
                          </div>
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

          {/* Upsell nudges — what the cashier can suggest to unlock a promo */}
          {cart.length > 0 && upsell.length > 0 ? (
            <div className="border-primary/30 bg-primary/5 rounded-2xl border p-3.5">
              <div className="flex items-center gap-2">
                <Lightbulb className="text-primary size-4" />
                <h3 className="text-sm font-bold">{t("upsellHeading")}</h3>
              </div>
              <div className="mt-2 space-y-1.5">
                {upsell.map((u, i) => (
                  <p
                    key={`${u.kind}-${u.promo.id}-${i}`}
                    className="text-foreground flex items-start gap-1.5 text-xs font-semibold"
                  >
                    <ArrowUp className="text-primary mt-0.5 size-3.5 flex-none" />
                    <span>{upsellText(u)}</span>
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {/* Inline reward redeem — optional, folded into this same sale */}
          {cart.length > 0 ? (
            <div className="border-border rounded-2xl border p-3.5">
              <div className="flex items-center gap-2">
                <Gift className="text-muted-foreground size-4" />
                <h3 className="text-sm font-bold">{t("inlineRewardHeading")}</h3>
              </div>
              {/* Experience reward instructions — what the cashier must hand over. */}
              {preselect?.note && inlineRewardId === preselect.rewardId ? (
                <div className="border-primary/30 bg-primary/5 mt-2 rounded-xl border p-2.5">
                  <div className="text-primary text-[0.6875rem] font-extrabold tracking-wider">
                    {t("rewardFulfillmentLabel")}
                  </div>
                  <p className="text-foreground mt-0.5 text-sm font-semibold">
                    {preselect.note}
                  </p>
                </div>
              ) : null}
              {availableRewards.isPending ? (
                <p className="text-muted-foreground mt-2 text-xs">{t("searching")}</p>
              ) : rewards.length === 0 && !preselect ? (
                <p className="text-muted-foreground mt-2 text-xs">{t("inlineRewardNone")}</p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {/* Claimed reward resolved from a scan/code but not in the
                      available list (edge) — still selectable so it can be redeemed. */}
                  {preselect && !rewards.some((r) => r.rewardId === preselect.rewardId) ? (
                    <RewardRow
                      name={preselect.name}
                      active={inlineRewardId === preselect.rewardId}
                      claimed
                      discountCents={
                        inlineRewardId === preselect.rewardId && rewardPreview?.ok
                          ? rewardPreview.discountCents
                          : null
                      }
                      claimedLabel={t("rewardClaimedBadge")}
                      onToggle={() =>
                        setInlineRewardId(
                          inlineRewardId === preselect.rewardId ? null : preselect.rewardId,
                        )
                      }
                    />
                  ) : null}
                  {rewards.map((rw) => {
                    const active = rw.rewardId === inlineRewardId;
                    return (
                      <RewardRow
                        key={rw.rewardId}
                        name={rw.name}
                        active={active}
                        claimed={preselect?.rewardId === rw.rewardId}
                        claimedLabel={t("rewardClaimedBadge")}
                        discountCents={active && rewardPreview?.ok ? rewardPreview.discountCents : null}
                        onToggle={() => setInlineRewardId(active ? null : rw.rewardId)}
                      />
                    );
                  })}
                </div>
              )}
              {/* The claimed/selected reward doesn't apply to the current cart
                  (e.g. a free-product reward whose item isn't in the ticket yet). */}
              {inlineRewardId && rewardPreview && !rewardPreview.ok ? (
                <div className="bg-muted mt-2 rounded-xl p-2.5">
                  <p className="text-muted-foreground text-xs font-semibold">
                    {rewardPreview.reason === "reward-item-not-in-cart"
                      ? t("rewardAddItemHint")
                      : t("inlineRewardError")}
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Order-level note — "para llevar", "mesa 4", etc. */}
          {cart.length > 0 ? (
            <input
              value={orderNote}
              onChange={(e) => setOrderNote(e.target.value)}
              placeholder={t("orderNotePlaceholder")}
              className="border-border bg-muted placeholder:text-muted-foreground/70 h-10 w-full rounded-2xl border px-3.5 text-sm font-semibold outline-none"
            />
          ) : null}

          {/* Totals */}
          {cart.length > 0 ? (
            <div className="bg-muted space-y-1.5 rounded-2xl p-3.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-semibold">{t("subtotal")}</span>
                <span className="font-bold">{formatCop(subtotal)}</span>
              </div>
              {promoDiscount > 0 ? (
                <div className="text-primary flex items-center justify-between">
                  <span className="font-semibold">{t("promoDiscount")}</span>
                  <span className="font-bold">− {formatCop(promoDiscount)}</span>
                </div>
              ) : null}
              {rewardDiscount > 0 ? (
                <div className="text-primary flex items-center justify-between">
                  <span className="font-semibold">
                    {t("rewardDiscount", { name: activeRewardName ?? "" })}
                  </span>
                  <span className="font-bold">− {formatCop(rewardDiscount)}</span>
                </div>
              ) : null}
              <div className="border-border flex items-center justify-between border-t pt-1.5">
                <span className="font-bold">{t("net")}</span>
                <span className="font-display text-lg font-semibold">{formatCop(net)}</span>
              </div>
            </div>
          ) : null}

          <Button
            variant="default"
            size="lg"
            disabled={cart.length === 0 || recordPurchase.isPending}
            onClick={onRecord}
            className="h-10 w-full gap-2 rounded-2xl text-base font-extrabold"
          >
            <Check className="size-5" />
            {t("recordPurchase")}
          </Button>
        </div>
      </div>

      {picker ? (
        <ProductPicker
          slug={picker.slug}
          fallbackName={picker.name}
          fallbackPriceCents={picker.priceCents}
          onAdd={addLine}
          onClose={() => setPicker(null)}
        />
      ) : null}

      <StorelessConfirm
        open={storelessOpen}
        onOpenChange={setStorelessOpen}
        onConfirm={() => void submit()}
      />
    </>
  );
}

/** One selectable reward in the inline-redeem list. A `claimed` reward (opened
 *  from a scan/code) gets a badge; the applied discount shows once it matches
 *  the current cart. */
function RewardRow({
  name,
  active,
  claimed,
  claimedLabel,
  discountCents,
  onToggle,
}: {
  name: string;
  active: boolean;
  claimed?: boolean;
  claimedLabel: string;
  discountCents: number | null;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        active
          ? "border-primary bg-primary/5 flex w-full items-center justify-between gap-3 rounded-xl border-2 p-2.5 text-left"
          : "border-border flex w-full items-center justify-between gap-3 rounded-xl border p-2.5 text-left"
      }
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold">{name}</span>
          {claimed ? (
            <span className="bg-primary/10 text-primary shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold">
              {claimedLabel}
            </span>
          ) : null}
        </div>
        {discountCents != null ? (
          <div className="text-primary text-xs font-semibold">− {formatCop(discountCents)}</div>
        ) : null}
      </div>
      {active ? <Check className="text-primary size-5 shrink-0" /> : null}
    </button>
  );
}

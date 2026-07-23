"use client";

import type { AppRouter } from "@loyalty/api";
import {
  Button,
  CurrencyInput,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useDebounce } from "ahooks";
import {
  Cake,
  Check,
  Gift,
  Lightbulb,
  Minus,
  Plus,
  QrCode,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
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
type RegisterContext = inferRouterOutputs<AppRouter>["customers"]["registerContext"];

export type PreselectReward = {
  rewardId: string;
  currency: "stamps" | "points" | "both";
  name: string;
  note?: string | null;
};

type CartItem = {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  unitAmountCents: number;
  qty: number;
  note: string;
};

const CURRENCY = "COP";

const formatCop = (cents: number): string =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: CURRENCY,
    maximumFractionDigits: 0,
  }).format(Math.round(cents) / 100);

function inlineRewardCurrency(rw: AvailableReward): "stamps" | "points" | "both" {
  if (rw.costMode === "and") return "both";
  if (rw.affordableWith.includes("stamps")) return "stamps";
  if (rw.affordableWith.includes("points")) return "points";
  return "stamps";
}

function isRewardPending(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { message?: string; data?: { code?: string } };
  return e.data?.code === "CONFLICT" && e.message === "REWARD_PENDING";
}

/**
 * The register board — the three-column POS after a socio is identified
 * (T4 Caja design, app brand): customer intelligence on the left (info, upsell,
 * promos, tips), the product catalog in the middle, and a dark live cart on the
 * right. Server-authoritative pricing via stamps.preview; records the sale via
 * stamps.recordPurchase. Adaptive: single-column stack on phone.
 */
export function RegisterBoard({
  customerId,
  customerName,
  register,
  wallet,
  availableRewards,
  preselect,
  onSuccess,
  onRewardPending,
  onCancel,
  onScan,
}: {
  customerId: string;
  customerName: string;
  register: RegisterContext | undefined;
  wallet: WalletView;
  availableRewards: AvailableReward[];
  preselect?: PreselectReward;
  onSuccess: (wallet: WalletView) => void;
  onRewardPending: () => void;
  onCancel: () => void;
  onScan: () => void;
}) {
  const t = useTranslations("Cashier");
  const trpc = useTRPC();
  const activeStoreId = useActiveStoreId();

  const [mode, setMode] = useState<"items" | "total">("items");
  const [priceCop, setPriceCop] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [picker, setPicker] = useState<{ slug: string; name: string; priceCents: number } | null>(
    null,
  );
  const [chosenPromoId, setChosenPromoId] = useState<string | null>(null);
  const [inlineRewardId, setInlineRewardId] = useState<string | null>(
    preselect?.rewardId ?? null,
  );
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [promoFilter, setPromoFilter] = useState<"customer" | "all">("customer");
  const [storelessOpen, setStorelessOpen] = useState(false);

  // ── Catalog (middle) ────────────────────────────────────────────────────────
  const debouncedQuery = useDebounce(query.trim(), { wait: 250 });
  const categories = useQuery(
    trpc.menu.categories.queryOptions(undefined, { staleTime: CATALOG_STALE_MS }),
  );
  const menu = useQuery(
    trpc.menu.list.queryOptions(
      {
        search: debouncedQuery || undefined,
        categorySlug: cat || undefined,
        storeId: activeStoreId ?? undefined,
        pageSize: 40,
      },
      { staleTime: CATALOG_STALE_MS },
    ),
  );
  const products = menu.data?.items ?? [];

  // ── Cart + pricing ──────────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + i.unitAmountCents * i.qty, 0),
    [cart],
  );
  const rewards = availableRewards;
  const chosenReward = rewards.find((r) => r.rewardId === inlineRewardId) ?? null;
  const activeRewardCurrency: "stamps" | "points" | "both" | null =
    inlineRewardId == null
      ? null
      : inlineRewardId === preselect?.rewardId
        ? (preselect?.currency ?? null)
        : chosenReward
          ? inlineRewardCurrency(chosenReward)
          : null;
  const inlineReward =
    inlineRewardId != null && activeRewardCurrency != null
      ? { rewardId: inlineRewardId, currency: activeRewardCurrency }
      : undefined;

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
  const net = preview.data?.net ?? null;

  useEffect(() => {
    setChosenPromoId(preview.data?.applicable[0]?.promo.id ?? null);
  }, [preview.data]);

  const promoDiscount =
    promos.find((p) => p.promo.id === chosenPromoId)?.discountCents ?? 0;
  const rewardDiscount = rewardPreview?.ok ? rewardPreview.discountCents : 0;
  const tierDiscount = net?.tierDiscountCents ?? 0;
  const total = net ? net.netPriceCents : Math.max(0, subtotal - promoDiscount - rewardDiscount);

  const recordPurchase = useMutation(trpc.stamps.recordPurchase.mutationOptions());

  // Static promos catalog (left panel).
  const promoCatalog = useQuery(
    trpc.promociones.staffCatalog.queryOptions(undefined, { staleTime: CATALOG_STALE_MS }),
  );

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
  const bump = (key: string, delta: number) =>
    setCart((c) =>
      c.map((i) => (i.key === key ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0),
    );
  const removeLine = (key: string) => setCart((c) => c.filter((i) => i.key !== key));

  const onRecord = () => {
    if (mode === "total" ? priceCop === undefined : cart.length === 0) return;
    if (!activeStoreId) {
      setStorelessOpen(true);
      return;
    }
    void submit();
  };

  const submit = async () => {
    setStorelessOpen(false);
    try {
      const view = await recordPurchase.mutateAsync(
        mode === "total"
          ? {
              customerId,
              storeId: activeStoreId ?? undefined,
              priceCents: Math.round((priceCop ?? 0) * 100),
              idempotencyKey: crypto.randomUUID(),
            }
          : {
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
            },
      );
      onSuccess(view);
      setInlineRewardId(null);
      toast.success(t("purchaseRecorded"));
    } catch (err) {
      if (isRewardPending(err)) {
        toast.error(t("rewardPendingToast"));
        onRewardPending();
        return;
      }
      const msg = err instanceof Error ? err.message : "";
      if (msg === "reward-not-redeemable") {
        toast.error(t("inlineRewardError"));
        setInlineRewardId(null);
        return;
      }
      if (msg === "PROMO_NOT_APPLICABLE") {
        toast.error(t("promoNotApplicable"));
        setChosenPromoId(null);
        return;
      }
      toast.error(msg || t("purchaseError"));
    }
  };

  const upsellText = (u: (typeof upsell)[number]): string => {
    switch (u.kind) {
      case "add-item":
        return t("upsellAddItem");
      case "spend-to-threshold":
        return t("upsellSpend", { amount: formatCop(u.addCents) });
      case "variant-swap":
        return t("upsellSwap", {
          extra: formatCop(u.extraCents),
          discount: formatCop(u.discountCents),
        });
    }
  };

  // Cashier tips — derived from the customer context (birthday, rewards, favorite).
  const tips: { icon: React.ReactNode; text: string }[] = [];
  if (register?.birthdayInDays != null)
    tips.push({
      icon: <Cake className="size-3.5" />,
      text:
        register.birthdayInDays === 0
          ? t("birthdayToday")
          : t("birthdaySoon", { days: register.birthdayInDays }),
    });
  if (rewards.length > 0)
    tips.push({ icon: <Gift className="size-3.5" />, text: t("tipReadyReward", { count: rewards.length }) });
  if (register?.topProduct)
    tips.push({ icon: <Sparkles className="size-3.5" />, text: t("tipFavorite", { product: register.topProduct }) });

  const cartCount = cart.reduce((n, i) => n + i.qty, 0);
  const recordDisabled =
    recordPurchase.isPending || (mode === "total" ? priceCop === undefined : cart.length === 0);

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 lg:h-full lg:min-h-0">
      {/* ── IDENTITY BAR ─────────────────────────────────────────────────── */}
      <div className="flex flex-none flex-wrap items-center gap-3 rounded-3xl bg-[#161b22] p-4 text-white">
        <button
          type="button"
          onClick={() => setInfoModalOpen(true)}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <span className="from-primary to-primary/70 grid size-11 flex-none place-items-center rounded-2xl bg-gradient-to-br font-display text-sm font-semibold">
            {(customerName[0] ?? "S").toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold">{customerName}</div>
            <div className="truncate text-xs font-semibold text-white/50">
              {register?.phoneMasked
                ? `${register.phoneMasked} · ${t("tapForFicha")}`
                : t("tapForFicha")}
            </div>
          </div>
        </button>
        {register?.tier ? (
          <div className="flex flex-col">
            <span className="bg-primary/20 text-primary-foreground inline-flex items-center gap-1 self-start rounded-full px-2.5 py-0.5 text-xs font-extrabold text-white capitalize">
              ★ {register.tier.name}
            </span>
            {register.tier.nextName ? (
              <span className="mt-0.5 text-[0.625rem] font-bold text-white/50">
                {t("ptsToNext", { pts: register.tier.remainingToNext, tier: register.tier.nextName })}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="mx-1 h-8 w-px bg-white/10" />
        <Balance label={t("stamps")} value={`${wallet.currentStamps} / ${wallet.walletSize}`} />
        <Balance label={t("detailPoints")} value={String(register?.points ?? 0)} />
        <div className="flex-1" />
        {register?.tier.benefits[0] ? (
          <span className="hidden rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-[0.6875rem] font-bold text-white/80 sm:block">
            {register.tier.benefits[0]}
          </span>
        ) : null}
        <button
          type="button"
          onClick={onScan}
          className="grid size-9 flex-none place-items-center rounded-xl border border-white/15 text-white/70 hover:text-white"
          aria-label={t("scanRewardCode")}
        >
          <QrCode className="size-4" />
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-primary flex-none rounded-xl px-3 py-2 text-xs font-extrabold text-white"
        >
          {t("changeCustomer")}
        </button>
      </div>

      {register?.banned ? (
        <div className="border-destructive/40 bg-destructive/10 text-destructive flex flex-none items-center gap-2 rounded-2xl border p-3 text-sm font-bold">
          <X className="size-4 flex-none" />
          {t("customerBanned")}
        </div>
      ) : null}

      {/* ── THREE COLUMNS — each scrolls independently, fills the height ── */}
      <div className="flex flex-col gap-4 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[300px_minmax(0,1fr)_360px] lg:gap-4">
        {/* LEFT — customer intelligence (this column scrolls on desktop) */}
        <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {/* Ideas de upsell */}
          {upsell.length > 0 ? (
            <div className="bg-card border-border rounded-3xl border p-4 shadow-sm">
              <div className="text-primary mb-3 flex items-center gap-1.5 text-sm font-bold">
                <Lightbulb className="size-4" />
                {t("upsellHeading")}
              </div>
              <div className="space-y-2">
                {upsell.map((u, i) => (
                  <div
                    key={`${u.kind}-${u.promo.id}-${i}`}
                    className="border-primary/20 bg-primary/5 rounded-xl border p-2.5"
                  >
                    <p className="text-foreground text-xs font-semibold">{upsellText(u)}</p>
                    <span className="bg-primary/10 text-primary mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-extrabold">
                      {u.promo.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Promos */}
          <div className="bg-card border-border rounded-3xl border p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-sm font-bold">{t("promosActive")}</span>
              <div className="bg-muted flex rounded-lg p-0.5">
                {(["customer", "all"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setPromoFilter(f)}
                    className={`rounded-md px-2 py-1 text-[10px] font-bold ${promoFilter === f ? "bg-card shadow-sm" : "text-muted-foreground"}`}
                  >
                    {f === "customer" ? t("promoFilterCustomer") : t("promoFilterAll")}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              {(promoFilter === "customer" ? promos.map((p) => p.promo) : (promoCatalog.data ?? []))
                .slice(0, 6)
                .map((p) => (
                  <div key={p.id} className="bg-muted/50 flex items-center gap-2 rounded-xl p-2">
                    <span className="bg-primary/10 text-primary grid size-6 flex-none place-items-center rounded-lg">
                      <Tag className="size-3" />
                    </span>
                    <span className="truncate text-xs font-bold">{p.name}</span>
                  </div>
                ))}
              {(promoFilter === "customer" ? promos.length : (promoCatalog.data?.length ?? 0)) ===
              0 ? (
                <p className="text-muted-foreground text-xs font-semibold">{t("noPromos")}</p>
              ) : null}
            </div>
          </div>

          {/* Tips para el cajero */}
          {tips.length > 0 ? (
            <div className="bg-card border-border rounded-3xl border p-4 shadow-sm">
              <div className="text-primary mb-2 text-xs font-extrabold">{t("tipsTitle")}</div>
              <div className="space-y-2">
                {tips.map((tip) => (
                  <div
                    key={tip.text}
                    className="text-foreground flex items-start gap-2 text-xs font-semibold"
                  >
                    <span className="bg-primary/10 text-primary mt-0.5 grid size-5 flex-none place-items-center rounded-md">
                      {tip.icon}
                    </span>
                    <span>{tip.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* MIDDLE — catalog (products scroll internally) */}
        <div className="bg-card border-border flex flex-col rounded-3xl border p-4 shadow-sm lg:min-h-0">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg font-bold">{t("recordPurchaseTitle")}</span>
          </div>
          <div className="bg-muted my-3 grid max-w-xs grid-cols-2 gap-1 rounded-2xl p-1">
            {(["items", "total"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={
                  mode === m
                    ? "bg-card rounded-xl py-2 text-sm font-bold shadow-sm"
                    : "text-muted-foreground rounded-xl py-2 text-sm font-bold"
                }
              >
                {t(m === "items" ? "modeItems" : "modeTotal")}
              </button>
            ))}
          </div>

          {mode === "items" ? (
            <>
              <div className="border-border bg-muted flex h-11 items-center gap-2 rounded-2xl border px-3.5">
                <Search className="text-muted-foreground/70 size-4" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("productSearch")}
                  className="placeholder:text-muted-foreground/70 w-full bg-transparent text-sm font-semibold outline-none"
                />
              </div>
              <div className="scrollbar-hide -mx-1 mt-2.5 flex gap-2 overflow-x-auto px-1 pb-1">
                <Chip active={!cat} onClick={() => setCat(null)}>
                  {t("all")}
                </Chip>
                {(categories.data ?? []).map((c) => (
                  <Chip key={c.id} active={cat === c.slug} onClick={() => setCat(cat === c.slug ? null : c.slug)}>
                    {c.name}
                  </Chip>
                ))}
              </div>
              <div className="scrollbar-hide mt-3 grid grid-cols-2 content-start gap-2.5 xl:grid-cols-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPicker({ slug: p.slug, name: p.name, priceCents: p.priceCents })}
                    className="border-border bg-muted/40 flex flex-col gap-1 rounded-2xl border p-3 text-left"
                  >
                    <span className="truncate text-sm font-bold">{p.name}</span>
                    {p.description ? (
                      <span className="text-muted-foreground/70 line-clamp-2 text-xs font-semibold">
                        {p.description}
                      </span>
                    ) : null}
                    <span className="text-primary mt-auto pt-1 text-sm font-extrabold">
                      {formatCop(p.promoPriceCents ?? p.priceCents)}
                    </span>
                  </button>
                ))}
                {products.length === 0 ? (
                  <p className="text-muted-foreground col-span-full py-8 text-center text-sm">
                    {menu.isPending ? t("searching") : t("menuEmpty")}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center py-10">
              <span className="text-muted-foreground mb-2 text-xs font-bold tracking-wider uppercase">
                {t("priceLabel")}
              </span>
              <CurrencyInput
                currency="COP"
                locale="es-CO"
                decimalScale={0}
                value={priceCop}
                onValueChange={setPriceCop}
                placeholder={t("pricePlaceholder")}
                className="h-12 max-w-xs text-center"
              />
              <p className="text-muted-foreground mt-3 max-w-xs text-center text-xs">
                {t("totalModeHint")}
              </p>
            </div>
          )}
        </div>

        {/* RIGHT — dark cart (fills the column; lines scroll internally) */}
        <div className="flex flex-col gap-4 lg:min-h-0">
          <div className="flex flex-col rounded-3xl bg-[#161b22] p-4 text-white lg:min-h-0 lg:flex-1">
            <div className="flex flex-none items-center justify-between">
              <span className="font-display text-base font-bold">{t("cartTitle")}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">
                {t("cartCount", { count: cartCount })}
              </span>
            </div>

            {mode === "total" ? (
              <div className="flex-1 py-8 text-center text-sm font-semibold text-white/40">
                {t("totalModeCart")}
              </div>
            ) : cart.length === 0 ? (
              <div className="flex-1 py-10 text-center text-sm font-semibold text-white/40">
                {t("cartEmpty")}
              </div>
            ) : (
              <div className="scrollbar-hide my-3 flex-1 space-y-2 overflow-y-auto">
                {cart.map((i) => (
                  <div key={i.key} className="rounded-2xl bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold">{i.name}</div>
                        {i.note ? (
                          <div className="mt-0.5 truncate text-xs font-semibold text-amber-300 italic">
                            ✎ {i.note}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex-none text-sm font-extrabold">
                        {formatCop(i.unitAmountCents * i.qty)}
                      </div>
                    </div>
                    <div className="mt-2 flex items-center gap-1.5">
                      <div className="flex-1" />
                      <button
                        type="button"
                        onClick={() => bump(i.key, -1)}
                        className="grid size-7 place-items-center rounded-lg bg-white/10"
                        aria-label={t("decrease")}
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-bold">{i.qty}</span>
                      <button
                        type="button"
                        onClick={() => bump(i.key, 1)}
                        className="grid size-7 place-items-center rounded-lg bg-white/10"
                        aria-label={t("increase")}
                      >
                        <Plus className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeLine(i.key)}
                        className="grid size-7 place-items-center rounded-lg text-white/50 hover:text-white"
                        aria-label={t("removeLine")}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {mode === "items" && cart.length > 0 ? (
              <input
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder={t("orderNotePlaceholder")}
                className="mb-3 h-9 w-full flex-none rounded-xl bg-white/5 px-3 text-xs font-semibold text-white placeholder:text-white/40 outline-none"
              />
            ) : null}

            {/* Totals */}
            <div className="flex-none border-t border-white/10 pt-3 text-sm">
              {mode === "items" && cart.length > 0 ? (
                <>
                  <Row label={t("subtotal")} value={formatCop(subtotal)} muted />
                  {promoDiscount > 0 ? (
                    <Row label={t("promoDiscount")} value={`− ${formatCop(promoDiscount)}`} good />
                  ) : null}
                  {rewardDiscount > 0 ? (
                    <Row label={t("rewardDiscountShort")} value={`− ${formatCop(rewardDiscount)}`} good />
                  ) : null}
                  {tierDiscount > 0 ? (
                    <Row label={t("tierDiscountShort")} value={`− ${formatCop(tierDiscount)}`} good />
                  ) : null}
                </>
              ) : null}
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="font-bold">{t("net")}</span>
                <span className="font-display text-2xl font-bold">
                  {mode === "total"
                    ? formatCop(Math.round((priceCop ?? 0) * 100))
                    : formatCop(total)}
                </span>
              </div>
              <Button
                size="lg"
                disabled={recordDisabled}
                onClick={onRecord}
                className="mt-3 h-12 w-full gap-2 rounded-2xl text-base font-extrabold"
              >
                <Check className="size-5" />
                {t("recordPurchase")}
              </Button>
            </div>
          </div>

          {/* Listos para canjear */}
          {mode === "items" && rewards.length > 0 ? (
            <div className="bg-card border-border flex-none rounded-3xl border p-4 shadow-sm">
              <div className="text-primary mb-2 flex items-center gap-1.5 text-xs font-extrabold">
                <Gift className="size-4" />
                {t("readyToRedeem")}
              </div>
              <div className="scrollbar-hide max-h-44 space-y-1.5 overflow-y-auto">
                {rewards.map((rw) => {
                  const active = rw.rewardId === inlineRewardId;
                  return (
                    <button
                      key={rw.rewardId}
                      type="button"
                      onClick={() => setInlineRewardId(active ? null : rw.rewardId)}
                      className={
                        active
                          ? "border-primary bg-primary/5 flex w-full items-center justify-between gap-2 rounded-xl border-2 p-2.5 text-left"
                          : "border-border flex w-full items-center justify-between gap-2 rounded-xl border p-2.5 text-left"
                      }
                    >
                      <span className="truncate text-xs font-bold">{rw.name}</span>
                      {active ? <Check className="text-primary size-4 flex-none" /> : null}
                    </button>
                  );
                })}
              </div>
              {inlineRewardId && rewardPreview && !rewardPreview.ok ? (
                <p className="text-muted-foreground mt-2 text-xs font-semibold">
                  {rewardPreview.reason === "reward-item-not-in-cart"
                    ? t("rewardAddItemHint")
                    : t("inlineRewardError")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Info del cliente — the ficha, from the identity bar (declutters the
          left column so upsell/promos/tips lead). */}
      <ResponsiveModal open={infoModalOpen} onOpenChange={setInfoModalOpen}>
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <div className="flex flex-col px-6 pt-2 pb-6">
            <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
              {t("infoTitle")}
            </ResponsiveModalTitle>
            {register ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <InfoTile
                    label={t("detailBirthday")}
                    value={
                      register.birthday
                        ? new Date(register.birthday).toLocaleDateString("es-CO", {
                            day: "numeric",
                            month: "short",
                          })
                        : "—"
                    }
                    sub={
                      register.birthdayInDays != null
                        ? t("birthdayInDays", { days: register.birthdayInDays })
                        : undefined
                    }
                  />
                  <InfoTile label={t("detailVisits")} value={String(register.visits)} />
                  <InfoTile
                    label={t("detailLastVisit")}
                    value={
                      register.lastVisitAt
                        ? new Date(register.lastVisitAt).toLocaleDateString("es-CO", {
                            day: "numeric",
                            month: "short",
                          })
                        : t("detailNever")
                    }
                  />
                  <InfoTile label={t("detailAvgTicket")} value={formatCop(register.avgTicketCents)} />
                  {register.topProduct ? (
                    <InfoTile label={t("detailTopProduct")} value={register.topProduct} full />
                  ) : null}
                </div>
                {register.tier.benefits.length > 0 ? (
                  <div className="mt-4">
                    <div className="text-primary mb-2 text-xs font-extrabold">
                      {t("tierBenefitsTitle", { tier: register.tier.name })}
                    </div>
                    {register.tier.nextName ? (
                      <>
                        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                          <div
                            className="bg-primary h-full rounded-full"
                            style={{ width: `${Math.round(register.tier.progress * 100)}%` }}
                          />
                        </div>
                        <div className="text-muted-foreground mt-1 mb-2 text-[0.6875rem] font-bold">
                          {t("ptsToNext", {
                            pts: register.tier.remainingToNext,
                            tier: register.tier.nextName,
                          })}
                        </div>
                      </>
                    ) : null}
                    <div className="space-y-1.5">
                      {register.tier.benefits.map((b) => (
                        <div
                          key={b}
                          className="text-foreground flex items-center gap-2 text-sm font-semibold"
                        >
                          <Check className="text-primary size-4 flex-none" />
                          {b}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {register.notes ? (
                  <div className="bg-muted/40 mt-4 rounded-xl p-3 text-sm font-semibold italic">
                    ✎ {register.notes}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground mt-4 text-sm">{t("searching")}</p>
            )}
          </div>
        </ResponsiveModalContent>
      </ResponsiveModal>

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
    </div>
  );
}

function Balance({ label, value }: { label: string; value: string }) {
  return (
    <div className="leading-tight">
      <div className="text-[0.5625rem] font-extrabold tracking-wider text-white/50 uppercase">
        {label}
      </div>
      <div className="text-sm font-extrabold">{value}</div>
    </div>
  );
}

function InfoTile({
  label,
  value,
  sub,
  full,
}: {
  label: string;
  value: string;
  sub?: string;
  full?: boolean;
}) {
  return (
    <div className={`bg-muted rounded-xl p-2.5 ${full ? "col-span-2" : ""}`}>
      <div className="text-muted-foreground/70 text-[0.625rem] font-extrabold tracking-wide uppercase">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-bold">{value}</div>
      {sub ? <div className="text-primary text-[0.625rem] font-bold">{sub}</div> : null}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  good,
}: {
  label: string;
  value: string;
  muted?: boolean;
  good?: boolean;
}) {
  return (
    <div className="flex justify-between font-semibold">
      <span className={muted ? "text-white/50" : good ? "text-primary" : ""}>{label}</span>
      <span className={good ? "text-primary font-bold" : "font-bold"}>{value}</span>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 flex-none rounded-full border px-3.5 text-xs font-bold whitespace-nowrap ${active ? "bg-foreground text-background border-foreground" : "bg-card text-muted-foreground border-border"}`}
    >
      {children}
    </button>
  );
}

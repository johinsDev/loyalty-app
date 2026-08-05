"use client";

import type { AppRouter } from "@loyalty/api";
import { formatBirthday } from "@loyalty/date";
import {
  Button,
  CurrencyInput,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { useDebounce } from "ahooks";
import {
  Cake,
  Check,
  ChevronDown,
  ChevronRight,
  Gift,
  Info,
  Lightbulb,
  Minus,
  Plus,
  QrCode,
  Search,
  Pencil,
  Sparkles,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import { CATALOG_STALE_MS } from "../catalog-cache";
import { useCashierMoney } from "../format";
import { useActiveStoreId } from "../use-active-store";

import { CashierChip } from "./chrome";
import { CashierDetailSheet, type CashierDetail } from "./detail-sheet";
import { ProductPicker, type PickedLine } from "./product-picker";
import { ConfirmSale, type ConfirmDiscount } from "./confirm-sale";
import { DecisionBar, type Decision } from "./decision-bar";

type WalletView = inferRouterOutputs<AppRouter>["stamps"]["walletForCustomer"];
export type SaleResult = inferRouterOutputs<AppRouter>["stamps"]["recordPurchase"];
type AvailableReward =
  inferRouterOutputs<AppRouter>["rewards"]["availableForCustomer"]["items"][number];

/** The reward list plus the query's own state. Passing only the rows made an
 *  error, an empty catalog and "none affordable" render identically as nothing. */
export type AvailableRewardsState = {
  items: AvailableReward[];
  publishedCount: number;
  /** The closest reward the customer can't afford yet. */
  nextReward: {
    rewardId: string;
    name: string;
    pointsCost: number;
    pointsMissing: number;
  } | null;
  isPending: boolean;
  isError: boolean;
  refetch: () => void;
};
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
  addonIds: string[];
  removedIngredientIds: string[];
  name: string;
  unitAmountCents: number;
  qty: number;
  note: string;
  /** The parts behind `name` + `unitAmountCents`, so the cart can show what the
   *  line is made of instead of one flat string and one flat price. */
  baseName: string;
  basePriceCents: number;
  addons: { id: string; name: string; priceDeltaCents: number }[];
  removedLabels: string[];
};

const CURRENCY = "COP";

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
  availableRewards: AvailableRewardsState;
  preselect?: PreselectReward;
  onSuccess: (result: SaleResult) => void;
  onRewardPending: () => void;
  onCancel: () => void;
  onScan: () => void;
}) {
  const t = useTranslations("Cashier");
  const locale = useLocale();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const activeStoreId = useActiveStoreId();
  const formatCop = useCashierMoney(CURRENCY);

  const [mode, setMode] = useState<"items" | "total">("items");
  const [priceCop, setPriceCop] = useState<number | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderNote, setOrderNote] = useState("");
  /** Key of the cart line being edited, so the picker replaces it instead of
   *  appending. Editing beats delete-and-re-add: removing a line can drop the
   *  applied reward or promo, which the cashier then has to pick again. */
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ slug: string; name: string; priceCents: number } | null>(
    null,
  );
  /**
   * The promo the cashier explicitly picked — NOT the one on the ticket.
   *
   * The server auto-applies the biggest applicable promo whenever no id is
   * sent. This used to mirror that answer back into the next request, which
   * pinned it: a cart that started as one Classic got "$3.000 off toda la
   * orden", and adding the matcha that unlocks "Classic + Matcha al 50%"
   * (−$7.500) kept charging the old one, because the register was now *asking*
   * for it. $4.500 decided by the order the cashier tapped things in.
   */
  const [cashierPromoId, setCashierPromoId] = useState<string | null>(null);
  const [inlineRewardId, setInlineRewardId] = useState<string | null>(
    preselect?.rewardId ?? null,
  );
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [promoFilter, setPromoFilter] = useState<"customer" | "all">("customer");
  /** Show the promos the register didn't apply, so one can be swapped in. */
  const [promosOpen, setPromosOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // The cashier declined the promo outright. Needed because the server picks the
  // best one whenever no id is sent, so clearing the selection alone had it
  // reappear on the very next preview — the promo was impossible to refuse.
  const [promoOptOut, setPromoOptOut] = useState(false);

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
  const rewards = availableRewards.items;
  // A reward scanned at identify time that isn't in the claimable list (archived
  // since the QR was minted, tier-locked, already claimed) was still applied but
  // rendered nowhere, so the cashier couldn't see or remove it.
  const pinnedPreselect =
    preselect && !rewards.some((r) => r.rewardId === preselect.rewardId) ? preselect : null;
  const previewRewardIds = pinnedPreselect
    ? [...rewards.map((r) => r.rewardId), pinnedPreselect.rewardId]
    : rewards.map((r) => r.rewardId);
  const rewardCostText = (rw: AvailableReward): string => {
    const parts: string[] = [];
    if (rw.stampsRequired != null) parts.push(`${rw.stampsRequired} ${t("stampMany")}`);
    if (rw.pointsCost != null) parts.push(`${rw.pointsCost} ${t("earnPtsUnit")}`);
    return parts.join(rw.costMode === "and" ? " + " : " / ") || t("rewardFree");
  };
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
          addonIds: i.addonIds.length ? i.addonIds : undefined,
          removedIngredientIds: i.removedIngredientIds.length ? i.removedIngredientIds : undefined,
          qty: i.qty,
          unitAmountCents: i.unitAmountCents,
        })),
        inlineReward,
        rewardIds: previewRewardIds,
        // Only an explicit choice travels. Sending back whatever the server
        // last applied would freeze that pick against every later cart.
        appliedPromoId: cashierPromoId ?? undefined,
        skipPromo: promoOptOut || undefined,
      },
      // Keep the last preview on screen while the next one is in flight. The
      // cart key changes on every +/-, so without this `preview.data` blanked
      // out and the promos, the discounts, the earn line and every eligibility
      // mark unmounted and remounted — the whole panel jumped on each tap.
      { enabled: cart.length > 0, placeholderData: keepPreviousData },
    ),
  );
  // `keepPreviousData` is what stops the panel flickering on every tap, but it
  // outlives the cart: emptying it disables the query, so nothing ever settles
  // and React Query keeps serving the last cart's answer — the totals read
  // "0 ítems · $16.500". Every derived value goes through this, so an empty cart
  // shows nothing instead of the sale before it.
  const previewData = cart.length > 0 ? preview.data : undefined;
  const promos = previewData?.applicable ?? [];
  /** The server's swap, rendered as a derived view of the cart. */
  const upgrade = previewData?.rewardUpgrade ?? null;
  const upsell = previewData?.upsell ?? [];
  const rewardPreview = previewData?.reward ?? null;
  const net = previewData?.net ?? null;
  const earn = previewData?.earn ?? null;
  // Per-reward line eligibility (only meaningful once the cart has items).
  const eligByReward = useMemo(
    () => new Map((previewData?.rewardEligibility ?? []).map((e) => [e.rewardId, e])),
    [previewData],
  );
  // Eligibility marks are only trustworthy when a preview actually succeeded for
  // this cart. Without this guard a failed or in-flight preview leaves
  // `eligByReward` empty, which read as "everything applies".
  const cartEvaluated = cart.length > 0 && preview.isSuccess;
  const rewardsScrollRef = useRef<HTMLDivElement>(null);
  // Whether the rewards list is scrolled to its end, so the fade + arrow can
  // get out of the last row's way. Starts true: a list that doesn't overflow
  // never fires a scroll event, and it has nothing to scroll to either.
  const [rewardsAtEnd, setRewardsAtEnd] = useState(true);
  /** Whether the rewards this cart can't satisfy are expanded. */
  const [rewardsShowAll, setRewardsShowAll] = useState(false);
  const syncRewardsEnd = (el: HTMLDivElement | null) => {
    if (!el) return;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    // Only on change. An unconditional set from a callback ref re-rendered,
    // which re-ran the ref, which set again — "Maximum update depth exceeded".
    setRewardsAtEnd((prev) => (prev === atEnd ? prev : atEnd));
  };
  const [detailView, setDetailView] = useState<CashierDetail | null>(null);

  // Drop an explicit promo choice once the cart stops satisfying it, so the
  // register falls back to the server's best-of instead of asking for a promo
  // the sale would then be rejected for.
  useEffect(() => {
    if (!cashierPromoId) return;
    if (cart.length === 0) {
      setCashierPromoId(null);
      return;
    }
    if (!cartEvaluated) return;
    if (!promos.some((p) => p.promo.id === cashierPromoId)) setCashierPromoId(null);
  }, [cashierPromoId, cart.length, cartEvaluated, promos]);

  // Drop a selected reward the moment the cart stops satisfying it. Removing
  // the qualifying drink left the row greyed out *and* still ticked, and the
  // sale would have gone through with a reward the server then refused.
  useEffect(() => {
    if (!inlineRewardId) return;
    // Emptying the cart counts too: eligibility isn't evaluated at all then, so
    // the reward stayed ticked while every row around it was greyed out.
    if (cart.length === 0) {
      setInlineRewardId(null);
      return;
    }
    if (!cartEvaluated) return;
    const elig = eligByReward.get(inlineRewardId);
    if (elig && !elig.eligible) setInlineRewardId(null);
  }, [inlineRewardId, cart.length, cartEvaluated, eligByReward]);

  // Measure the rewards scroller after the list renders. The ref is stable, so
  // it can't do the first measurement itself, and rows changing height (an
  // ineligibility line appearing) changes whether there's anything below.
  useEffect(() => {
    syncRewardsEnd(rewardsScrollRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewards.length, cartEvaluated, inlineRewardId]);

  /**
   * What a promo is worth, in the unit it actually pays in. A points multiplier
   * discounts nothing, so every row of "Puntos x3" read "− $ 0" — which looks
   * like a promo that is broken rather than one that pays in points.
   */
  const promoWorth = (a: (typeof promos)[number]): string =>
    a.discountCents > 0
      ? `− ${formatCop(a.discountCents)}`
      : a.pointsMultiplier > 1
        ? t("promoPointsMult", { mult: a.pointsMultiplier })
        : "—";

  /** What is actually on the ticket — the server's answer, not a local guess. */
  const chosenPromoId = net?.appliedPromoId ?? null;
  const appliedPromo = promos.find((p) => p.promo.id === chosenPromoId) ?? null;
  // All three come from the server's `net`, which is what the sale is charged
  // from. The raw evaluations overstate: `resolveNet` applies the stacking
  // policy (an exclusive promo zeroes the reward) and then the max-total cap.
  // Drawing the raw reward discount put "Recompensa − $5.000" on a ticket where
  // it had been suppressed — the total was right, the lines above it were not,
  // and the sale then failed at charge time with a bare error.
  const promoDiscount = net ? net.promoDiscountCents : (appliedPromo?.discountCents ?? 0);
  const rewardDiscount = net
    ? net.rewardDiscountCents
    : rewardPreview?.ok
      ? rewardPreview.discountCents
      : 0;
  const tierDiscount = net?.tierDiscountCents ?? 0;
  const tierPct = net?.tierDiscountPct ?? 0;
  /** The cashier picked a reward the applied promo refuses to share a ticket
   *  with. `recordPurchase` rejects this outright, so it has to be resolved
   *  here rather than discovered when the sale fails. */
  const rewardSuppressed = Boolean(inlineRewardId) && Boolean(net?.suppressed.reward);
  const total = net ? net.netPriceCents : Math.max(0, subtotal - promoDiscount - rewardDiscount);

  // Name the drink the reward lands on, wherever the amount is shown. An
  // unattributed "Recompensa − $17.000" left the cashier guessing which of the
  // lines it belonged to. An order-wide voucher keeps the generic label,
  // because it really does apply to the whole ticket.
  const rewardLineIndex = upgrade?.sourceLineIndex ?? rewardPreview?.lineIndex ?? null;
  const rewardLine = rewardLineIndex != null ? cart[rewardLineIndex] : undefined;
  // A free add-on waives ONE unit's add-on, not the line's. On "3 × Brown Sugar
  // Boba · Perlas · Shot de espresso" the customer paid for three Perlas and
  // gets one back, and the old label — the line's whole name, add-ons and all —
  // said neither which add-on nor how many. Name the add-on, count the units,
  // and identify the line by the drink alone.
  const rewardDiscountLabel = !rewardLine
    ? t("rewardDiscountShort")
    : rewardPreview?.targetLabel
      ? rewardLine.qty > 1
        ? t("rewardDiscountAddonOfN", {
            addon: rewardPreview.targetLabel,
            item: rewardLine.baseName,
            qty: rewardLine.qty,
          })
        : t("rewardDiscountAddon", {
            addon: rewardPreview.targetLabel,
            item: rewardLine.baseName,
          })
      : t("rewardDiscountOn", { item: rewardLine.baseName });

  /** Lines the applied promo discounts — badged in the cart, so the totals row
   *  can stay a short name instead of a wrapped list of drinks. */
  const promoLineIndexes = useMemo(
    () => new Set(appliedPromo?.lineIndexes ?? []),
    [appliedPromo],
  );
  const promoDiscountLabel = appliedPromo?.promo.name ?? t("promoDiscount");
  /** The lines the promo singles out — the free drink of a 3x2, the halved one
   *  of a pair. The badge used to mark all three participants identically, so
   *  the cashier couldn't tell which one they were giving away. */
  const promoDiscountedLines = useMemo(
    () => new Set(appliedPromo?.discountedLineIndexes ?? []),
    [appliedPromo],
  );

  /**
   * One sentence explaining which promo is on the ticket and why, whenever more
   * than one qualifies. A purchase carries a single promo, so the register
   * silently applies the biggest — and that reads as a switcheroo to a cashier
   * who added a drink chasing a specific one. Two truths worth saying:
   * the automatic pick is the biggest (and by how much), or the cashier
   * overrode it and is leaving money on the table.
   */
  /** The best promo the register did NOT apply. `promos` arrives sorted by
   *  discount desc, so the first non-applied row is the alternative worth
   *  naming. */
  const promoRunnerUp = useMemo(() => {
    if (!appliedPromo || promos.length < 2) return null;
    return promos.find((p) => p.promo.id !== appliedPromo.promo.id) ?? null;
  }, [appliedPromo, promos]);

  /** Two promos worth exactly the same. Neither answer is wrong, so the
   *  register stops narrating and asks — see the decision bar. */
  const promoTie =
    appliedPromo != null &&
    promoRunnerUp != null &&
    appliedPromo.discountCents === promoRunnerUp.discountCents;

  /**
   * Why THIS promo. Only one can ride a purchase and the register picks the
   * biggest, which turned a followed upsell into a bait and switch: the cashier
   * adds a drink chasing "$5.000 de descuento" and the ticket says "Segunda
   * unidad al 50%". It's the better deal, it just never said so.
   *
   * This is the sentence the panel leads with — the "tell". A tie says nothing
   * here on purpose: it's a question, and it lives in the decision bar.
   */
  const promoChoice = useMemo(() => {
    if (!appliedPromo || !promoRunnerUp) return null;
    const delta = appliedPromo.discountCents - promoRunnerUp.discountCents;
    if (delta > 0)
      return t("promoWhyBest", { name: appliedPromo.promo.name, delta: formatCop(delta) });
    if (delta < 0)
      return t("promoWhySmaller", {
        name: appliedPromo.promo.name,
        other: promoRunnerUp.promo.name,
        delta: formatCop(-delta),
      });
    return null;
  }, [appliedPromo, promoRunnerUp, t]);

  // Same three discounts the cart draws, so the review sheet can't disagree
  // with the line the cashier just read.
  const confirmDiscounts: ConfirmDiscount[] = [];
  if (mode === "items") {
    if (promoDiscount > 0)
      confirmDiscounts.push({
        label: promoDiscountLabel,
        amountCents: promoDiscount,
      });
    if (rewardDiscount > 0)
      confirmDiscounts.push({ label: rewardDiscountLabel, amountCents: rewardDiscount });
    if (tierDiscount > 0)
      confirmDiscounts.push({
        label:
          register?.tier && tierPct > 0
            ? t("tierDiscountPct", { tier: register.tier.name, pct: tierPct })
            : t("tierDiscountShort"),
        amountCents: tierDiscount,
      });
  }

  const recordPurchase = useMutation(trpc.stamps.recordPurchase.mutationOptions());

  // Static promos catalog (left panel).
  const promoCatalog = useQuery(
    trpc.promociones.staffCatalog.queryOptions(undefined, { staleTime: CATALOG_STALE_MS }),
  );

  const addLine = (line: PickedLine) => {
    setCart((c) => {
      // Merge into an existing line when the configuration is identical (same
      // variant, add-ons, removals and note) instead of stacking duplicates.
      const idx = c.findIndex((i) => sameConfig(i, line));
      if (idx >= 0) {
        return c.map((i, n) => (n === idx ? { ...i, qty: i.qty + line.qty } : i));
      }
      return [...c, { ...line, key: crypto.randomUUID() }];
    });
    setPicker(null);
  };
  const bump = (key: string, delta: number) =>
    setCart((c) =>
      c.map((i) => (i.key === key ? { ...i, qty: i.qty + delta } : i)).filter((i) => i.qty > 0),
    );
  const removeLine = (key: string) => setCart((c) => c.filter((i) => i.key !== key));

  // A sale can't be voided, so it goes through a review sheet instead of firing
  // on the button. The storeless warning rides inside that sheet.
  const onRecord = () => {
    if (mode === "total" ? priceCop === undefined : cart.length === 0) return;
    setConfirmOpen(true);
  };

  const submit = async () => {
    setConfirmOpen(false);
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
                addonIds: i.addonIds.length ? i.addonIds : undefined,
                removedIngredientIds: i.removedIngredientIds.length
                  ? i.removedIngredientIds
                  : undefined,
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
      // The sale just moved numbers that are still on screen, and nothing was
      // invalidating them: with the 30s default staleTime, charging a sale
      // worth 11 points left "PUNTOS HOY" showing the figure from before it.
      // The customer's own reads go too — they just earned, and possibly spent,
      // stamps and points, which changes what they can claim.
      void queryClient.invalidateQueries(trpc.stamps.shiftSummary.queryFilter());
      void queryClient.invalidateQueries(trpc.stamps.walletForCustomer.queryFilter());
      void queryClient.invalidateQueries(trpc.customers.registerContext.queryFilter());
      void queryClient.invalidateQueries(trpc.rewards.availableForCustomer.queryFilter());
      // The success used to replace this whole view, so the cart died with the
      // unmount. It's a modal now and the board stays mounted underneath —
      // leaving a charged cart sitting behind it, one tap from being charged
      // again. Clear the sale's state explicitly instead of relying on unmount.
      setCart([]);
      setOrderNote("");
      setPriceCop(undefined);
      setCashierPromoId(null);
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
        setCashierPromoId(null);
        return;
      }
      toast.error(msg || t("purchaseError"));
    }
  };

  /**
   * An upsell nudge, shaped for the counter: the sentence the cashier says, the
   * money when it can be stated honestly, and what the promo behind it gives.
   * The card used to print only the action ("Sumá $13.500 más") beside the
   * promo's name, which said nothing about what the customer gets for it —
   * there was nothing there to sell with.
   */
  const upsellView = (u: (typeof upsell)[number]) => {
    const scope = u.kind === "add-item" ? u.missingLabels : [];
    const base = {
      scope,
      /** What the promo grants once unlocked — the reason to bother. */
      benefit: u.promo.benefitSummary ?? u.promo.shortDescription,
      econ: null as string | null,
    };
    switch (u.kind) {
      case "add-item":
        return {
          ...base,
          headline:
            scope.length > 0
              ? t("upsellAddItemNamed", { item: scope.join(" o ") })
              : t("upsellAddItem"),
          how: t("upsellHowAddItem"),
        };
      case "spend-to-threshold":
        return {
          ...base,
          headline: t("upsellSpend", { amount: formatCop(u.addCents) }),
          how: t("upsellHowSpend", { amount: formatCop(u.addCents) }),
        };
      case "variant-swap":
        return {
          ...base,
          headline: u.toLabel
            ? t("upsellSwapNamed", { to: u.toLabel, extra: formatCop(u.extraCents) })
            : t("upsellSwap", {
                extra: formatCop(u.extraCents),
                discount: formatCop(u.discountCents),
              }),
          // The whole pitch on one line: what it costs, what it saves, and the
          // difference — the only number that decides the sale.
          econ: t("upsellSwapEcon", {
            extra: formatCop(u.extraCents),
            discount: formatCop(u.discountCents),
            net: formatCop(u.discountCents - u.extraCents),
          }),
          how: t("upsellHowSwap", { to: u.toLabel ?? "" }),
        };
    }
  };

  /** Open an upsell's detail: what the promo gives, how to unlock it, and — for
   *  a swap — the button that performs it on the right cart line. */
  const openUpsellDetail = (u: (typeof upsell)[number]) => {
    const v = upsellView(u);
    const line = u.kind === "variant-swap" ? cart[u.lineIndex] : undefined;
    const prod = line ? products.find((p) => p.id === line.productId) : undefined;
    setDetailView({
      title: u.promo.name,
      benefit: v.benefit,
      lines: [v.headline],
      cost: v.econ,
      scope: v.scope,
      how: v.how,
      // Reuses the cart-line editor: the swap is exactly "open this line and
      // pick the bigger size", so the cashier lands in the picker with the
      // line's add-ons and note already filled in.
      apply:
        line && prod
          ? {
              label: t("upsellSwapAction"),
              run: () => {
                setEditingKey(line.key);
                setPicker({ slug: prod.slug, name: prod.name, priceCents: prod.priceCents });
              },
            }
          : undefined,
    });
  };

  /**
   * A reward the cart can't satisfy. Only meaningful once a preview actually
   * succeeded for this cart — otherwise a missing entry would read as "doesn't
   * apply" while the preview is still in flight.
   */
  const rewardIneligible = (rw: AvailableReward) => {
    const elig = eligByReward.get(rw.rewardId);
    return cartEvaluated && elig != null && !elig.eligible;
  };

  /** What stays inside the scroller — the applied reward is pinned above it. */
  const listedRewards = rewards.filter((rw) => rw.rewardId !== chosenReward?.rewardId);
  /** In a typical cart 6 of 11 rewards don't apply. They used to be drawn in
   *  grey with their reason, burying the ones the cashier can actually offer. */
  const listedEligible = listedRewards.filter((rw) => !rewardIneligible(rw));
  const listedIneligible = listedRewards.filter(rewardIneligible);
  const eligibleCount = rewards.filter((rw) => !rewardIneligible(rw)).length;

  /**
   * One promo row. `lead` is the applied one: it's the panel's statement, so it
   * carries the largest type in the panel. The rest only appear once the
   * cashier opens the list, at data weight.
   */
  const renderPromoRow = (a: (typeof promos)[number], lead: boolean) => {
    const active = a.promo.id === chosenPromoId;
    return (
      <button
        key={a.promo.id}
        type="button"
        onClick={() =>
          setDetailView({
            title: a.promo.name,
            lines: [a.promo.shortDescription || a.promo.benefitSummary || ""].filter(
              Boolean,
            ) as string[],
            cost: promoWorth(a),
            apply: {
              label: active ? t("promoRemove") : t("promoApply"),
              run: () => {
                setCashierPromoId(active ? null : a.promo.id);
                setPromoOptOut(active);
              },
            },
          })
        }
        className={`flex w-full items-center gap-2 rounded-xl border p-2 text-left transition-colors ${
          active ? "border-primary bg-primary/5" : "border-transparent bg-muted/50 hover:bg-muted"
        }`}
      >
        <span className="bg-primary/10 text-primary grid size-6 flex-none place-items-center rounded-lg">
          <Tag className="size-3" />
        </span>
        {/* Two lines rather than truncating: "Segunda unidad al 5…" cuts off the
            very number the cashier needs. The amount stays pinned right. */}
        <span
          className={`line-clamp-2 min-w-0 flex-1 font-bold ${lead ? "text-sm" : "text-xs"}`}
        >
          {a.promo.name}
          {/* A promo that fired twice looked identical to one that fired once —
              five drinks under "segunda unidad al 50%" quietly took half off
              two of them. */}
          {a.applications > 1 ? (
            <span className="text-muted-foreground ml-1 font-extrabold">×{a.applications}</span>
          ) : null}
        </span>
        <span
          className={`flex-none font-extrabold whitespace-nowrap ${lead ? "text-sm" : "text-xs"} ${
            active ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {promoWorth(a)}
        </span>
        {/* Always holds its width. Appearing on select stole space from the
            name, which re-wrapped and changed the row's height — that was the
            jump. */}
        <Check className={`text-primary size-3.5 flex-none ${active ? "" : "invisible"}`} />
      </button>
    );
  };

  /** One row of the "listos para canjear" list. Extracted because the selected
   *  reward is rendered twice — pinned above the scroller and, when nothing is
   *  selected, inside it — and the two must look and behave identically. */
  const renderRewardRow = (rw: AvailableReward) => {
    const active = rw.rewardId === inlineRewardId;
    const elig = eligByReward.get(rw.rewardId);
    // The selected reward stays clickable so it can be deselected.
    const ineligible = rewardIneligible(rw);
    // Enabled only once it can actually be redeemed, mirroring the promos
    // panel. An empty cart made every reward look clickable when none of them
    // could be applied to anything — a reward always discounts something.
    const blocked = !active && (cart.length === 0 || ineligible);
    return (
      <div key={rw.rewardId} className="flex items-stretch gap-1">
        <button
          type="button"
          onClick={() =>
            setDetailView({
              title: rw.name,
              // The operator's own copy is the only free prose here.
              lines: rw.description?.trim() ? [rw.description] : [],
              benefit: rw.benefitSummary,
              // What actually qualifies. "en productos seleccionados" gave the
              // cashier nothing to repeat to a customer.
              scope: rw.scopeNames,
              cost: rewardCostText(rw),
              note: rw.fulfillmentNote,
              warning: ineligible ? reasonLabel(elig?.reason, t, elig?.upgrade) : null,
              apply: {
                label: active ? t("rewardRemove") : t("rewardApply"),
                // An ineligible reward can still be removed, never added.
                disabled: blocked,
                run: () => setInlineRewardId(active ? null : rw.rewardId),
              },
            })
          }
          // Same geometry as a promo row — this panel sits right under Promos
          // and they are read as one list. `min-w-0` is load-bearing: a flex
          // item won't shrink below its content without it, so the
          // ineligibility line pushed the row past the panel and shoved the
          // detail button off-screen. Border width is constant; only its colour
          // changes — swapping `border` for `border-2` on select reflowed the
          // row by 1px, and that was the bounce.
          className={`flex min-w-0 flex-1 items-center gap-2 rounded-xl border p-2 text-left transition-colors ${
            active
              ? "border-primary bg-primary/5"
              : blocked
                ? "border-transparent bg-muted/40 cursor-not-allowed opacity-55"
                : "border-transparent bg-muted/50 hover:bg-muted"
          }`}
        >
          <span className="bg-primary/10 text-primary grid size-6 flex-none place-items-center rounded-lg">
            <Gift className="size-3" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-xs font-bold">{rw.name}</span>
            {ineligible ? (
              <span className="text-muted-foreground/70 mt-0.5 line-clamp-2 block text-[0.6875rem] font-semibold">
                {reasonLabel(elig?.reason, t, elig?.upgrade)}
              </span>
            ) : null}
          </span>
          <span
            className={`flex-none text-xs font-extrabold ${active ? "text-primary" : "text-muted-foreground"}`}
          >
            {rewardCostText(rw)}
          </span>
          <Check className={`text-primary size-3.5 flex-none ${active ? "" : "invisible"}`} />
        </button>
      </div>
    );
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
  // No "tiene N premios listos" tip: the rewards panel's heading now states
  // exactly that, and better — it counts the ones this cart can satisfy.
  if (register?.topProduct)
    tips.push({ icon: <Sparkles className="size-3.5" />, text: t("tipFavorite", { product: register.topProduct }) });

  const cartCount = cart.reduce((n, i) => n + i.qty, 0);

  /**
   * The prices on screen belong to a different cart than the one in the cart.
   *
   * Deliberately NOT `preview.isError`, which arrives late and sometimes never.
   * React Query pauses retries while the tab is hidden, so a failed preview
   * sits at `fetchStatus: "paused"` with `isPending` true for as long as the
   * register is in the background; and even in front of the cashier the default
   * three retries with backoff take several seconds to give up. `keepPreviousData`
   * holds the previous cart's totals on screen through all of it.
   *
   * So the check is about agreement, not about failure: the server echoes the
   * subtotal of the cart it actually priced. If that doesn't match what this
   * cart adds up to, the numbers came from somewhere else — failed, paused, or
   * still in flight.
   *
   * `variantUpgrade` legitimately shifts the subtotal by the upgrade delta,
   * because the server prices the swapped cart; that is expected, not a
   * mismatch.
   */
  const expectedSubtotal = subtotal + (upgrade?.deltaCents ?? 0);
  const pricingStale =
    mode === "items" &&
    cart.length > 0 &&
    previewData != null &&
    previewData.subtotalCents !== expectedSubtotal;

  const recordDisabled =
    recordPurchase.isPending ||
    (mode === "total" ? priceCop === undefined : cart.length === 0) ||
    // Recording now would drop the reward server-side without a trace.
    (mode === "total" && inlineRewardId != null) ||
    // The server rejects this combination; block it here instead of letting the
    // cashier discover it as a failed sale.
    rewardSuppressed ||
    // Charging off a stale preview would take the previous cart's money.
    pricingStale;

  /**
   * Everything the register needs an answer to, in one strip above the columns.
   *
   * Blocking first — both entries below also feed `recordDisabled`, so the bar
   * always explains a disabled Cobrar button rather than leaving the cashier to
   * guess why it went grey.
   */
  const decisions: Decision[] = [];
  if (pricingStale)
    decisions.push({
      id: "stale",
      tone: "blocking",
      message: t("pricingStale"),
      actions: [{ label: t("retry"), onClick: () => void preview.refetch() }],
    });
  if (rewardSuppressed)
    decisions.push({
      id: "reward-conflict",
      tone: "blocking",
      message: t("rewardNotCombinable", { promo: promoDiscountLabel }),
      actions: [
        { label: t("removeReward"), onClick: () => setInlineRewardId(null) },
        {
          label: t("dropPromoForReward"),
          onClick: () => {
            setCashierPromoId(null);
            setPromoOptOut(true);
          },
        },
      ],
    });
  // Only while the register is the one that chose. Once the cashier answers,
  // asking again — with the two names merely swapped — reads as the register
  // not having accepted the answer.
  if (promoTie && cashierPromoId == null && appliedPromo && promoRunnerUp)
    decisions.push({
      id: "promo-tie",
      tone: "choice",
      message: t("promoTieAsk", {
        name: appliedPromo.promo.name,
        other: promoRunnerUp.promo.name,
      }),
      actions: [
        {
          label: appliedPromo.promo.name,
          onClick: () => setCashierPromoId(appliedPromo.promo.id),
        },
        {
          label: promoRunnerUp.promo.name,
          onClick: () => setCashierPromoId(promoRunnerUp.promo.id),
        },
      ],
    });

  return (
    <div className="flex flex-col gap-3 p-3 sm:p-4 lg:h-full lg:min-h-0">
      {/* ── IDENTITY BAR ─────────────────────────────────────────────────── */}
      <div className="flex flex-none flex-wrap items-center gap-3 rounded-3xl bg-[var(--cashier-ink)] p-4 text-white">
        <button
          type="button"
          onClick={() => setInfoModalOpen(true)}
          className="flex min-w-0 items-center gap-3 rounded-2xl text-left hover:bg-white/5"
        >
          <span className="from-primary to-primary/70 grid size-11 flex-none place-items-center rounded-2xl bg-gradient-to-br font-display text-sm font-semibold">
            {(customerName[0] ?? "S").toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-extrabold">{customerName}</div>
            <div className="text-primary-foreground/90 flex items-center gap-0.5 truncate text-xs font-bold">
              {register?.phoneMasked ? `${register.phoneMasked} · ` : ""}
              <span className="text-primary underline decoration-white/30 underline-offset-2">
                {t("viewFicha")}
              </span>
            </div>
          </div>
          <ChevronRight className="size-4 flex-none text-white/40" />
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
          <span
            title={t("tierBenefitChipTitle", { tier: register.tier.name })}
            className="hidden items-center gap-1.5 rounded-xl border border-amber-300/40 bg-amber-300/15 px-3 py-1.5 text-[0.6875rem] font-bold text-amber-100 sm:inline-flex"
          >
            <Sparkles className="size-3 flex-none text-amber-300" />
            {t("tierBenefitChipLabel", { tier: register.tier.name })}
            <span className="text-amber-200/60">·</span>
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

      {/* ── DECISIONS — the one place the register asks for something ────── */}
      <DecisionBar decisions={decisions} />

      {/* ── THREE COLUMNS — each scrolls independently, fills the height ── */}
      <div className="flex flex-col gap-4 lg:grid lg:min-h-0 lg:flex-1 lg:grid-cols-[340px_minmax(0,1fr)_420px] lg:gap-4">
        {/* LEFT — customer intelligence (this column scrolls on desktop) */}
        <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
          {/* "Qué ofrecerle" — everything the cashier can say to this customer,
              in one panel, strongest first: the upsells carry money, the reward
              nudge is the next thing within reach, and the tips (birthday,
              favourite) are colour. They used to be two bordered boxes saying
              overlapping things.

              The server ranks the upsells by what the customer nets, so the
              strongest pitch is row one, and only the top two are drawn: a
              cashier mid-order reads one suggestion, not six. */}
          {upsell.length > 0 || availableRewards.nextReward || tips.length > 0 ? (
            <div className="border-primary/40 bg-primary/[0.06] rounded-3xl border-2 p-3.5 shadow-sm">
              <div className="text-primary mb-2.5 flex items-center gap-1.5 text-sm font-bold">
                <Lightbulb className="size-4 flex-none" />
                {t("offerHeading")}
              </div>
              <div className="space-y-1.5">
                {upsell.slice(0, 2).map((u, i) => {
                  const v = upsellView(u);
                  return (
                    <button
                      key={`${u.kind}-${u.promo.id}-${i}`}
                      type="button"
                      onClick={() => openUpsellDetail(u)}
                      className="border-primary/20 bg-card hover:border-primary/50 w-full rounded-xl border p-2.5 text-left transition-colors"
                    >
                      <p className="text-foreground text-sm leading-snug font-bold">{v.headline}</p>
                      {/* The money, when a swap lets us price it end to end.
                          "+$2.000 → ahorra $8.250" is the argument; the promo's
                          name alone never was. */}
                      {v.econ ? (
                        <p className="text-primary mt-0.5 text-xs leading-snug font-extrabold">
                          {v.econ}
                        </p>
                      ) : null}
                      <span className="mt-1.5 flex items-center gap-1">
                        <Tag className="text-primary/70 size-3 flex-none" />
                        <span className="text-primary min-w-0 flex-1 truncate text-[0.6875rem] font-extrabold">
                          {u.promo.name}
                        </span>
                        <Info className="text-primary/50 size-3.5 flex-none" />
                      </span>
                      {/* What the promo actually gives. Without it the cashier
                          was asking for $13.500 more in exchange for a name. */}
                      {v.benefit ? (
                        <span className="text-muted-foreground mt-0.5 line-clamp-2 block text-[0.6875rem] font-semibold">
                          {v.benefit}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {/* The reward the customer is closest to. "Listos para canjear"
                  only ever showed what was already paid for, so the cashier had
                  nothing to say to the socio who is 36 points away — the one
                  moment a nudge is worth anything. Points only: a stamp needs a
                  whole extra visit, which this sale can't close. */}
              {availableRewards.nextReward ? (
                <div className="border-primary/20 bg-card mt-1.5 rounded-xl border p-2.5">
                  <p className="text-foreground text-sm leading-snug font-bold">
                    {t("nextRewardNudge", {
                      pts: availableRewards.nextReward.pointsMissing,
                      reward: availableRewards.nextReward.name,
                    })}
                  </p>
                  <span className="mt-1 flex items-center gap-1">
                    <Gift className="text-primary/70 size-3 flex-none" />
                    <span className="text-primary min-w-0 flex-1 truncate text-[0.6875rem] font-extrabold">
                      {t("nextRewardCost", { pts: availableRewards.nextReward.pointsCost })}
                    </span>
                  </span>
                </div>
              ) : null}
              {/* Birthday and favourite drink: worth saying, never worth their
                  own bordered panel competing with the pitch above. Support
                  weight, at the bottom. */}
              {tips.length > 0 ? (
                <div className="border-primary/15 mt-2.5 space-y-1.5 border-t pt-2.5">
                  {tips.map((tip) => (
                    <div
                      key={tip.text}
                      className="text-muted-foreground flex items-start gap-2 text-[0.6875rem] leading-snug"
                    >
                      <span className="text-primary/70 mt-px flex-none">{tip.icon}</span>
                      <span className="min-w-0">{tip.text}</span>
                    </div>
                  ))}
                </div>
              ) : null}
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
              {promoFilter === "customer" ? (
                // A failed preview leaves the previous cart's promos listed,
                // with their old amounts, looking applicable. Said quietly here
                // — the decision bar is already shouting it with the retry.
                // This line only explains why the panel has nothing, so it
                // doesn't read as "no promo applies".
                pricingStale ? (
                  <p className="text-muted-foreground text-[0.6875rem] leading-snug">
                    {t("promosStale")}
                  </p>
                ) : promos.length === 0 ? (
                  <p className="text-muted-foreground text-xs font-semibold">
                    {cart.length === 0 ? t("promoAddItems") : t("noPromos")}
                  </p>
                ) : (
                  <>
                    {/* The register states what it did, in one row, instead of
                        listing six candidates of equal weight and leaving the
                        cashier to work out which one won. */}
                    {appliedPromo ? (
                      renderPromoRow(appliedPromo, true)
                    ) : (
                      <p className="text-muted-foreground text-xs font-semibold">
                        {t("promoNoneApplied")}
                      </p>
                    )}
                    {/* The reason, promoted from a grey footnote under six rows
                        to the sentence right under the one that won. */}
                    {promoChoice ? (
                      <p className="text-foreground pt-0.5 text-xs leading-snug font-semibold">
                        {promoChoice}
                      </p>
                    ) : null}
                    {/* The rest exist and are reachable, but they don't get to
                        occupy the panel: a count hints at them without listing
                        them. */}
                    {promos.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => setPromosOpen((o) => !o)}
                        className="text-primary pt-0.5 text-[0.6875rem] font-bold underline underline-offset-2"
                      >
                        {promosOpen
                          ? t("promoLess")
                          : t("promoMore", { count: promos.length - (appliedPromo ? 1 : 0) })}
                      </button>
                    ) : null}
                    {promosOpen ? (
                      <div className="space-y-1.5 pt-1">
                        {/* Interface instruction, so it appears exactly when the
                            switchable list does — not permanently above it. */}
                        <p className="text-muted-foreground text-[0.6875rem]">
                          {t("promoTapToSwitch")}
                        </p>
                        {promos
                          .filter((a) => a.promo.id !== appliedPromo?.promo.id)
                          .map((a) => renderPromoRow(a, false))}
                      </div>
                    ) : null}
                  </>
                )
              ) : (promoCatalog.data ?? []).length === 0 ? (
                <p className="text-muted-foreground text-xs font-semibold">{t("noPromos")}</p>
              ) : (
                (promoCatalog.data ?? []).slice(0, 6).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      setDetailView({
                        title: p.name,
                        lines: [p.shortDescription || p.benefitSummary || ""].filter(
                          Boolean,
                        ) as string[],
                      })
                    }
                    className="bg-muted/50 hover:bg-muted flex w-full items-center gap-2 rounded-xl p-2 text-left"
                  >
                    <span className="bg-primary/10 text-primary grid size-6 flex-none place-items-center rounded-lg">
                      <Tag className="size-3" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold">{p.name}</span>
                    <Info className="text-muted-foreground/50 size-3.5 flex-none" />
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Listos para canjear. Sits beside Promos because both answer the
              same question — what can I offer this customer — and because this
              column scrolls on its own. Under the cart it was boxed into a
              240px scroller: 2.5 of 11 rewards visible, detail buttons clipped
              against the panel edge. The panel stays mounted whenever the cart
              is itemized: an empty list is a message, not an absence. */}
          {mode === "items" ? (
            <div className="bg-card border-border rounded-3xl border p-4 shadow-sm">
              {/* The heading states the answer to "is there anything to offer
                  this customer" instead of making the cashier count a scroller
                  of eleven rows to find out. */}
              <div className="text-primary mb-2 flex items-center gap-1.5 text-sm font-bold">
                <Gift className="size-4 flex-none" />
                {cartEvaluated && rewards.length > 0
                  ? t("rewardsApplyCount", { count: eligibleCount, total: rewards.length })
                  : t("readyToRedeem")}
                {!cartEvaluated && rewards.length > 0 ? (
                  <span className="bg-primary/10 text-primary ml-auto rounded-full px-2 py-0.5 text-[0.625rem] font-extrabold">
                    {rewards.length}
                  </span>
                ) : null}
              </div>
              {/* The applied reward, lifted out of the scroller. Eleven rewards
                  in, the selected one sat wherever it happened to be in the
                  list — below the fold, under the scroll arrow — so the cashier
                  had to scroll to find out what was applied to the sale they
                  were about to charge. */}
              {chosenReward ? (
                <div className="mb-2.5">
                  <p className="text-primary/70 mb-1 text-[0.625rem] font-extrabold tracking-wider uppercase">
                    {t("rewardAppliedLabel")}
                  </p>
                  {renderRewardRow(chosenReward)}
                </div>
              ) : null}
              <div className="relative">
                <div
                  ref={rewardsScrollRef}
                  onScroll={(e) => syncRewardsEnd(e.currentTarget)}
                  className="scrollbar-hide max-h-[26rem] space-y-2 overflow-y-auto pb-1"
                >
                  {availableRewards.isError ? (
                    <div className="space-y-2 py-3">
                      <p className="text-muted-foreground text-xs font-semibold">
                        {t("rewardsLoadError")}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10"
                        onClick={availableRewards.refetch}
                      >
                        {t("retry")}
                      </Button>
                    </div>
                  ) : availableRewards.isPending ? (
                    <p className="text-muted-foreground py-3 text-xs font-semibold">
                      {t("searching")}
                    </p>
                  ) : rewards.length === 0 && pinnedPreselect == null ? (
                    availableRewards.publishedCount === 0 ? (
                      <div className="space-y-2 py-3">
                        <p className="text-muted-foreground text-xs font-semibold">
                          {t("rewardsEmpty")}
                        </p>
                        <Link
                          href="/register/rewards"
                          className="text-primary text-xs font-extrabold underline"
                        >
                          {t("rewardsCatalogLink")}
                        </Link>
                      </div>
                    ) : (
                      <p className="text-muted-foreground py-3 text-xs font-semibold">
                        {t("rewardsNoneForMember", { count: availableRewards.publishedCount })}
                      </p>
                    )
                  ) : null}

                  {/* Why the eligibility marks are missing, when they are. */}
                  {!availableRewards.isError &&
                  (rewards.length > 0 || pinnedPreselect != null) ? (
                    cart.length === 0 ? (
                      <p className="text-muted-foreground/70 pb-1 text-xs font-semibold">
                        {t("rewardsAddItemsHint")}
                      </p>
                    ) : preview.isError ? (
                      <div className="space-y-2 pb-1">
                        <p className="text-muted-foreground text-xs font-semibold">
                          {t("rewardEvalError")}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-10"
                          onClick={() => void preview.refetch()}
                        >
                          {t("retry")}
                        </Button>
                      </div>
                    ) : preview.isPending ? (
                      <p className="text-muted-foreground/70 pb-1 text-xs font-semibold">
                        {t("rewardEvalPending")}
                      </p>
                    ) : null
                  ) : null}

                  {pinnedPreselect ? (
                    <PinnedPreselectRow
                      preselect={pinnedPreselect}
                      active={inlineRewardId === pinnedPreselect.rewardId}
                      elig={eligByReward.get(pinnedPreselect.rewardId)}
                      evaluated={cartEvaluated}
                      onToggle={() =>
                        setInlineRewardId(
                          inlineRewardId === pinnedPreselect.rewardId
                            ? null
                            : pinnedPreselect.rewardId,
                        )
                      }
                      onDetail={setDetailView}
                    />
                  ) : null}

                  {/* The pinned one is drawn above; leaving it here too would
                      show the same reward twice. */}
                  {listedEligible.map(renderRewardRow)}

                  {/* The ones this cart can't satisfy, with the same row and the
                      same reason as before — just no longer competing with what
                      the cashier can actually offer. */}
                  {listedIneligible.length > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setRewardsShowAll((s) => !s)}
                        className="text-primary pt-0.5 text-[0.6875rem] font-bold underline underline-offset-2"
                      >
                        {rewardsShowAll
                          ? t("rewardsLess")
                          : t("rewardsShowAll", { count: listedIneligible.length })}
                      </button>
                      {rewardsShowAll ? listedIneligible.map(renderRewardRow) : null}
                    </>
                  ) : null}
                </div>
                {/* Scroll affordance: a fade + a tappable down-arrow when the list
                    overflows (the hidden scrollbar didn't read as scrollable).
                    Both disappear at the end of the list — they used to sit on
                    top of the last reward, blurring its name and covering its
                    detail button, which is exactly when they're useless. */}
                {listedEligible.length > 3 && !rewardsAtEnd ? (
                  <>
                    <div className="from-card pointer-events-none absolute inset-x-0 bottom-0 h-8 rounded-b-3xl bg-gradient-to-t to-transparent" />
                    <button
                      type="button"
                      aria-label={t("scrollMore")}
                      onClick={() =>
                        rewardsScrollRef.current?.scrollBy({ top: 140, behavior: "smooth" })
                      }
                      className="bg-card border-border text-primary absolute right-1.5 bottom-1.5 grid size-8 place-items-center rounded-full border shadow-md"
                    >
                      <ChevronDown className="size-4" />
                    </button>
                  </>
                ) : null}
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

          {/* The cashier tips used to be a third bordered panel here. They live
              at the foot of "Qué ofrecerle" now, where they read as colour on
              the pitch instead of competing with it. */}
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
                <CashierChip active={!cat} onClick={() => setCat(null)}>
                  {t("all")}
                </CashierChip>
                {(categories.data ?? []).map((c) => (
                  <CashierChip key={c.id} active={cat === c.slug} onClick={() => setCat(cat === c.slug ? null : c.slug)}>
                    {c.name}
                  </CashierChip>
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
                      {p.variantFromCents != null
                        ? p.priceFrom
                          ? t("priceFrom", { price: formatCop(p.variantFromCents) })
                          : formatCop(p.variantFromCents)
                        : formatCop(p.promoPriceCents ?? p.priceCents)}
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
          <div className="flex flex-col rounded-3xl bg-[var(--cashier-ink)] p-4 text-white lg:min-h-0 lg:flex-1">
            <div className="flex flex-none items-center justify-between">
              <span className="font-display text-base font-bold">{t("cartTitle")}</span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold">
                {t("cartCount", { count: cartCount })}
              </span>
            </div>

            {mode === "total" ? (
              <div className="flex-1 py-8 text-center text-sm font-semibold text-white/40">
                {/* A reward can't be redeemed on a cartless sale: recordPurchase
                    evaluates `inlineReward` only inside its items branch, so the
                    server silently dropped it — the socio lost the sellos and
                    nobody saw it. Block the sale until it's resolved. */}
                {inlineRewardId != null ? (
                  <div className="mx-auto max-w-xs space-y-3 rounded-2xl bg-amber-400/10 p-4 text-left">
                    <p className="text-xs font-semibold text-amber-200">
                      {t("rewardTotalModeWarning")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-10 border-white/20 bg-transparent text-white hover:bg-white/10"
                        onClick={() => setMode("items")}
                      >
                        {t("switchToItemsMode")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-10 text-white hover:bg-white/10"
                        onClick={() => setInlineRewardId(null)}
                      >
                        {t("removeReward")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  t("totalModeCart")
                )}
              </div>
            ) : cart.length === 0 ? (
              <div className="flex-1 py-10 text-center text-sm font-semibold text-white/40">
                {t("cartEmpty")}
              </div>
            ) : (
              <div className="scrollbar-hide my-3 flex-1 space-y-2 overflow-y-auto">
                {cart.map((i, idx) => (
                  <div key={i.key} className="rounded-2xl bg-white/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        {/* The drink alone. The add-ons used to be glued onto
                            this string, which both wrapped the title onto three
                            lines and hid their prices inside one flat total. */}
                        <div className="line-clamp-2 text-sm font-bold">
                          {upgrade?.sourceLineIndex === idx && upgrade.remainingQty > 0
                            ? `${upgrade.remainingQty} × ${i.baseName}`
                            : i.baseName}
                        </div>
                        {/* Where the money went. Only when there's something to
                            break down — on a plain drink at qty 1 the line
                            total already IS the price. */}
                        {i.addons.length > 0 || i.removedLabels.length > 0 || i.qty > 1 ? (
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] font-semibold text-white/55">
                            {i.qty > 1 ? (
                              <span className="text-white/70">
                                {i.qty} × {formatCop(i.unitAmountCents)}
                              </span>
                            ) : null}
                            <span>{t("lineBase", { amount: formatCop(i.basePriceCents) })}</span>
                            {i.addons.map((a) => (
                              <span key={a.id} className="text-white/70">
                                {a.name} +{formatCop(a.priceDeltaCents)}
                              </span>
                            ))}
                            {i.removedLabels.map((r) => (
                              <span key={r} className="text-amber-300/80">
                                {r}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {i.note ? (
                          <div className="mt-0.5 truncate text-xs font-semibold text-amber-300 italic">
                            ✎ {i.note}
                          </div>
                        ) : null}
                      </div>
                      <div className="flex-none text-sm font-extrabold">
                        {/* qty 1 ⇒ the whole line moved up; its price lives on
                            the upgraded row below, so showing "$0" here just
                            reads as broken. */}
                        {upgrade?.sourceLineIndex === idx
                          ? upgrade.remainingQty > 0
                            ? formatCop(i.unitAmountCents * upgrade.remainingQty)
                            : ""
                          : formatCop(i.unitAmountCents * i.qty)}
                      </div>
                    </div>
                    {/* The server split this line; render the result rather than
                        mutating the cart, or the next preview would upgrade a
                        second unit. */}
                    {/* Written as an instruction, not a status: the cashier has
                        to hand over a drink, and the line above still reads
                        "Mediano". Violet-300 rather than the brand primary —
                        that purple on this near-black card sits around 3:1. */}
                    {upgrade?.sourceLineIndex === idx ? (
                      <div className="mt-2 rounded-xl border border-dashed border-violet-400/50 bg-violet-400/5 px-2.5 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 text-sm font-extrabold text-violet-200">
                            {t("rewardUpgradeLine", { to: upgrade.toLabel })}
                          </div>
                          <div className="flex-none text-sm font-extrabold">
                            {formatCop(upgrade.upgradedUnitAmountCents)}
                          </div>
                        </div>
                        <div className="mt-0.5 text-[0.6875rem] font-semibold text-white/60">
                          {t("rewardUpgradeNoPromo")}
                        </div>
                      </div>
                    ) : null}
                    {/* Mark the promo on the line it discounts, the way the
                        upgrade reward already does. Naming the drinks in the
                        totals row worked for one, but two wrapped onto three
                        lines and stopped being readable. */}
                    {rewardLineIndex === idx && !upgrade ? (
                      <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-dashed border-violet-400/50 bg-violet-400/5 px-2.5 py-1.5">
                        <Gift className="size-3 flex-none text-violet-300" />
                        {/* Wraps rather than truncating, and states the unit
                            count: "Perlas gratis · −$1.000" on a 3× line read
                            as though all three were free. */}
                        <span className="min-w-0 text-[0.6875rem] leading-snug font-bold text-violet-200">
                          {rewardPreview?.targetLabel
                            ? i.qty > 1
                              ? t("rewardOnLineNamedOfN", {
                                  item: rewardPreview.targetLabel,
                                  qty: i.qty,
                                  amount: formatCop(rewardDiscount),
                                })
                              : t("rewardOnLineNamed", {
                                  item: rewardPreview.targetLabel,
                                  amount: formatCop(rewardDiscount),
                                })
                            : t("rewardOnLine", { amount: formatCop(rewardDiscount) })}
                        </span>
                      </div>
                    ) : null}
                    {promoLineIndexes.has(idx) ? (
                      <div className="mt-2 flex items-center gap-1.5 rounded-xl border border-dashed border-emerald-400/40 bg-emerald-400/5 px-2.5 py-1.5">
                        <Tag className="size-3 flex-none text-emerald-300" />
                        <span className="min-w-0 truncate text-[0.6875rem] font-bold text-emerald-200">
                          {appliedPromo?.promo.name}
                          {promoDiscountedLines.has(idx) ? (
                            <span className="ml-1 rounded bg-emerald-400/25 px-1.5 py-0.5 font-extrabold text-emerald-100">
                              {t("promoOnThisOne")}
                            </span>
                          ) : null}
                        </span>
                      </div>
                    ) : null}
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={t("editLine")}
                        onClick={() => {
                          const prod = products.find((p) => p.id === i.productId);
                          if (!prod) return;
                          setEditingKey(i.key);
                          setPicker({
                            slug: prod.slug,
                            name: prod.name,
                            priceCents: prod.priceCents,
                          });
                        }}
                        className="grid size-7 place-items-center rounded-lg bg-white/10"
                      >
                        <Pencil className="size-3.5" />
                      </button>
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
                  <Row label={t("subtotal")} value={formatCop(previewData?.subtotalCents ?? subtotal)} muted />
                  {promoDiscount > 0 ? (
                    <Row
                      label={promoDiscountLabel}
                      value={`− ${formatCop(promoDiscount)}`}
                      good
                    />
                  ) : appliedPromo && appliedPromo.pointsMultiplier > 1 ? (
                    // A points promo takes nothing off, so the discount row
                    // above never drew and the multiplier was applied with
                    // nothing on screen saying so — the "+N pts" below was just
                    // a bigger number than usual.
                    <Row
                      label={promoDiscountLabel}
                      value={t("promoPointsMult", { mult: appliedPromo.pointsMultiplier })}
                      good
                    />
                  ) : null}
                  {rewardDiscount > 0 ? (
                    <Row label={rewardDiscountLabel} value={`− ${formatCop(rewardDiscount)}`} good />
                  ) : null}
                  {tierDiscount > 0 ? (
                    <Row
                      label={
                        register?.tier && tierPct > 0
                          ? t("tierDiscountPct", { tier: register.tier.name, pct: tierPct })
                          : t("tierDiscountShort")
                      }
                      value={`− ${formatCop(tierDiscount)}`}
                      good
                    />
                  ) : null}
                </>
              ) : null}
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <span className="font-bold">{t("net")}</span>
                <span className="font-display flex-none text-2xl font-bold tabular-nums whitespace-nowrap">
                  {mode === "total"
                    ? formatCop(Math.round((priceCop ?? 0) * 100))
                    : formatCop(total)}
                </span>
              </div>
              {/* What the socio will earn on this sale. */}
              {mode === "items" && earn && (earn.points > 0 || earn.stamps > 0) ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs font-bold">
                  <span className="text-white/50">{t("willEarn")}</span>
                  {earn.stamps > 0 ? (
                    <span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-amber-200">
                      +{earn.stamps} {t("stampMany")}
                    </span>
                  ) : null}
                  {earn.points > 0 ? (
                    <span className="bg-primary/20 rounded-full px-2 py-0.5 text-white">
                      +{earn.points} {t("earnPtsUnit")}
                    </span>
                  ) : null}
                </div>
              ) : null}
              {/* A points promo shows up as a bigger number than usual and
                  nothing else. Break it down, or the cashier can't tell the
                  customer what the promo is actually worth — and can't check
                  the register either. */}
              {mode === "items" && earn && earn.pointsMultiplier > 1 && earn.points > 0 ? (
                <p className="mt-1 text-[0.6875rem] leading-snug font-semibold text-white/60">
                  {t("earnPointsBreakdown", {
                    base: earn.basePoints,
                    extra: earn.points - earn.basePoints,
                    total: earn.points,
                  })}
                </p>
              ) : null}
              {/* Both warnings that used to sit here — stale pricing and the
                  reward/promo conflict — now live in the decision bar above the
                  columns, with their ways out as buttons. They still disable
                  Cobrar through `recordDisabled`; only where they're drawn
                  changed. */}
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
                        ? formatBirthday(register.birthday, {
                            locale,
                            preset: "dayMonthShort",
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
          initial={
            editingKey
              ? (() => {
                  const l = cart.find((c) => c.key === editingKey);
                  return l
                    ? {
                        variantId: l.variantId,
                        addonIds: l.addonIds,
                        removedIngredientIds: l.removedIngredientIds,
                        note: l.note,
                        qty: l.qty,
                      }
                    : null;
                })()
              : null
          }
          onAdd={(line) => {
            if (editingKey) {
              // Replace in place. Appending and deleting would reorder the cart
              // and momentarily drop the line the reward is attached to.
              setCart((c) =>
                c.map((it) =>
                  it.key === editingKey ? { ...line, key: it.key } : it,
                ),
              );
              setEditingKey(null);
              setPicker(null);
              return;
            }
            addLine(line);
          }}
          onClose={() => {
            setEditingKey(null);
            setPicker(null);
          }}
        />
      ) : null}

      <ConfirmSale
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={() => void submit()}
        pending={recordPurchase.isPending}
        customerName={customerName}
        lines={
          mode === "items"
            ? cart.map((i, idx) => ({
                key: i.key,
                name: i.name,
                qty: i.qty,
                amountCents: i.unitAmountCents * i.qty,
                note:
                  upgrade?.sourceLineIndex === idx
                    ? t("confirmUpgradeNote", {
                        to: upgrade.toLabel,
                        amount: formatCop(upgrade.deltaCents),
                      })
                    : null,
              }))
            : []
        }
        subtotalCents={
          mode === "items" ? (previewData?.subtotalCents ?? subtotal) : null
        }
        discounts={confirmDiscounts}
        totalCents={mode === "total" ? Math.round((priceCop ?? 0) * 100) : total}
        earned={mode === "items" ? earn : null}
        hasStore={Boolean(activeStoreId)}
        formatMoney={formatCop}
      />

      {/* Promo / reward detail — what it is + the condition to meet. Shared
          with the Premios tab so the same reward reads the same either way. */}
      <CashierDetailSheet
        detail={detailView}
        onClose={() => setDetailView(null)}
        scopeIcon={(s) =>
          (categories.data ?? []).some((c) => c.name === s) ? (
            <Tag className="size-3" />
          ) : (
            <Search className="size-3" />
          )
        }
        onScopeClick={(s) => {
          // A product chip opens its picker straight away — the cashier's next
          // move on "needs a Classic Milk Tea" is to add one, and making them
          // close the sheet, find it in the grid and tap again was three steps
          // for one intent. A category can't be added, so it filters. An upsell
          // names a variant ("Taro Milk Tea · Grande") — the product is the
          // part before the separator.
          const category = (categories.data ?? []).find((c) => c.name === s);
          const productName = s.split(" · ")[0] ?? s;
          const product = products.find((p) => p.name === s || p.name === productName);
          if (category) {
            setCat(category.slug);
            setQuery("");
          } else if (product) {
            setPicker({
              slug: product.slug,
              name: product.name,
              priceCents: product.priceCents,
            });
          } else {
            setQuery(productName);
            setCat(null);
          }
        }}
      />
    </div>
  );
}

/** Same sorted set of ids. */
function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort();
  const y = [...b].sort();
  return x.every((v, i) => v === y[i]);
}

/** Whether a cart line has the identical configuration as a freshly picked one
 *  (same variant, add-ons, removals and note) — so it merges instead of stacking. */
function sameConfig(i: CartItem, line: PickedLine): boolean {
  return (
    i.productId === line.productId &&
    i.variantId === line.variantId &&
    i.note === line.note &&
    sameSet(i.addonIds, line.addonIds) &&
    sameSet(i.removedIngredientIds, line.removedIngredientIds)
  );
}

/** Short reason a reward doesn't apply to the current cart. */
function reasonLabel(
  reason: string | null | undefined,
  t: ReturnType<typeof useTranslations>,
  /** Present for a size-upgrade reward, so the hint can name the size. */
  upgrade?: { fromLabel: string; toLabel: string } | null,
): string {
  if (reason === "reward-item-not-in-cart") return t("rewardAddItemHint");
  // "Add the product" is a lie for an upgrade reward — the product is right
  // there, it's the size that's wrong. Say which one to add.
  if (reason === "reward-no-upgrade-available") {
    return upgrade
      ? t("rewardUpgradeMissingSource", { from: upgrade.fromLabel, to: upgrade.toLabel })
      : t("rewardNotApplicable");
  }
  // An archived / deleted reward is a different problem for the cashier than one
  // that simply doesn't match the cart.
  if (reason === "reward-not-redeemable") return t("rewardScannedUnavailable");
  return t("rewardNotApplicable");
}

/**
 * The reward that arrived on the URL from a scanned QR but isn't in the
 * claimable list — archived since the code was minted, tier-locked, or already
 * claimed. It was still applied to the sale while rendering nowhere, so the
 * cashier had no way to see it, read its note, or take it off. Pinned above the
 * list and never auto-cleared: silent self-healing is what hid this.
 */
function PinnedPreselectRow({
  preselect,
  active,
  elig,
  evaluated,
  onToggle,
  onDetail,
}: {
  preselect: PreselectReward;
  active: boolean;
  elig:
    | {
        eligible: boolean;
        reason: string | null;
        upgrade?: { optionName: string; fromLabel: string; toLabel: string } | null;
      }
    | undefined;
  evaluated: boolean;
  onToggle: () => void;
  onDetail: (v: { title: string; lines: string[] }) => void;
}) {
  const t = useTranslations("Cashier");
  const name = preselect.name.trim() || t("rewardScannedFallback");
  const ineligible = evaluated && elig != null && !elig.eligible;
  const currencyLabel =
    preselect.currency === "points"
      ? t("earnPtsUnit")
      : preselect.currency === "both"
        ? `${t("stampMany")} + ${t("earnPtsUnit")}`
        : t("stampMany");

  return (
    <div className="flex items-stretch gap-1">
      <button
        type="button"
        onClick={onToggle}
        className={`border-primary/40 bg-primary/5 flex flex-1 items-center justify-between gap-2 rounded-2xl border p-3.5 text-left ${
          active ? "border-primary border-2" : ""
        }`}
      >
        <div className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold">{name}</span>
            <span className="bg-primary/10 text-primary flex-none rounded-full px-1.5 py-0.5 text-[0.625rem] font-extrabold">
              {t("rewardScannedBadge")}
            </span>
          </span>
          {preselect.note ? (
            <span className="text-muted-foreground/70 mt-0.5 block truncate text-xs font-semibold">
              {preselect.note}
            </span>
          ) : null}
          {ineligible ? (
            <span className="text-muted-foreground mt-0.5 block truncate text-xs font-semibold">
              {reasonLabel(elig?.reason, t, elig?.upgrade)}
            </span>
          ) : null}
        </div>
        {active ? <Check className="text-primary size-5 flex-none" /> : null}
      </button>
      <button
        type="button"
        aria-label={t("viewDetail")}
        onClick={() =>
          onDetail({
            title: name,
            lines: [currencyLabel, preselect.note, ineligible ? reasonLabel(elig?.reason, t, elig?.upgrade) : null]
              .filter((l): l is string => Boolean(l?.trim())),
          })
        }
        className="border-border text-muted-foreground hover:text-foreground grid aspect-square shrink-0 self-stretch place-items-center rounded-2xl border"
      >
        <Info className="size-4" />
      </button>
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
    // The amount is the part that must never wrap: with both spans shrinkable
    // it was the one that broke, leaving the minus sign stranded on one line
    // and "$ 2.500" on the next. `flex-none` + `nowrap` keeps it whole and
    // `min-w-0` lets the long label — "Premio en Classic Milk Tea · Mediano ·
    // Shot de espresso" — be the thing that wraps instead. `tabular-nums`
    // lines the column of figures up, the way the review sheet already does.
    <div className="flex items-center justify-between gap-3 py-0.5 font-semibold">
      {/* violet-300, not the brand primary: that purple on this near-black
          panel is about 3:1 and unreadable at this size. */}
      <span
        className={`min-w-0 leading-snug ${muted ? "text-white/50" : good ? "text-violet-300" : ""}`}
      >
        {label}
      </span>
      <span
        className={`flex-none tabular-nums whitespace-nowrap ${good ? "font-bold text-violet-300" : "font-bold"}`}
      >
        {value}
      </span>
    </div>
  );
}


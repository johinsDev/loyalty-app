"use client";

import type { AppRouter } from "@loyalty/api";
import { formatDate } from "@loyalty/date";
import { Badge, Button } from "@loyalty/ui";
import { useMutation } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import {
  Ban,
  ChevronRight,
  Clock,
  Gift,
  Hash,
  Megaphone,
  Pencil,
  Receipt,
  Send,
  Store as StoreIcon,
  Tag,
  User as UserIcon,
} from "lucide-react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";

import { Link } from "@/i18n/nav";
import { money } from "@/lib/money";
import { useHasRole } from "@/lib/role-context";
import { useTRPC } from "@/lib/trpc/client";

import { AdjustPointsDialog } from "./adjust-points-dialog";
import { VoidPurchaseDialog } from "./void-purchase-dialog";

type PurchaseAdminDetail = NonNullable<
  inferRouterOutputs<AppRouter>["purchases"]["adminGet"]
>;

const TIER_KEYS = ["hoja", "flor", "oro"] as const;

/**
 * The admin "radiografía" of one purchase. Rendered both as the `?detalle=`
 * quick-view modal (`variant="modal"`) and the full `/purchases/[id]` page
 * (`variant="page"`). Read-only in v1; every entity (customer/store/promo/
 * reward/product) deep-links to its own admin detail.
 */
export function PurchaseDetailView({
  detail,
  variant = "page",
}: {
  detail: PurchaseAdminDetail;
  variant?: "page" | "modal";
}) {
  const t = useTranslations("Purchases");
  const locale = useLocale();
  const format = useFormatter();
  const trpc = useTRPC();
  const isOwner = useHasRole("owner");
  const [voidOpen, setVoidOpen] = useState(false);
  const voided = detail.voidedAt != null;
  const resend = useMutation(
    trpc.purchases.resendReceipt.mutationOptions({
      onSuccess: () => toast.success(t("resendOk")),
      onError: () => toast.error(t("resendError")),
    }),
  );

  const promoShare = detail.promo?.discountCents ?? 0;
  const rewardShare = Math.max(0, detail.discountCents - promoShare);
  const amountOnly = detail.items.length === 0;

  const customerBlock = <CustomerBlock detail={detail} />;
  const transactionBlock = <TransactionBlock detail={detail} />;
  const breakdownBlock = (
    <BreakdownBlock detail={detail} promoShare={promoShare} rewardShare={rewardShare} amountOnly={amountOnly} />
  );
  const loyaltyBlock = <LoyaltyBlock detail={detail} />;
  const redeemBlock = detail.reward ? <RedeemBlock reward={detail.reward} /> : null;
  const itemsBlock = amountOnly ? null : <ItemsBlock items={detail.items} />;
  const timelineBlock = <TimelineBlock detail={detail} />;

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div
          className={`font-display text-3xl font-semibold tracking-tight ${voided ? "text-muted-foreground line-through" : ""}`}
        >
          {money(format, detail.totalCents, detail.currency)}
        </div>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {formatDate(detail.createdAt, { locale, preset: "long" })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {voided ? <Badge variant="destructive">{t("voided")}</Badge> : null}
        {detail.promo ? <Badge variant="secondary">{t("badgePromo")}</Badge> : null}
        {detail.reward ? <Badge variant="secondary">{t("badgeReward")}</Badge> : null}
        {detail.stampsEarned > 0 ? <Badge variant="outline">{t("badgeStamp")}</Badge> : null}
        {!voided ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 rounded-xl"
            onClick={() => resend.mutate({ id: detail.id })}
            disabled={resend.isPending}
          >
            <Send className="size-3.5" />
            {t("resendReceipt")}
          </Button>
        ) : null}
        {isOwner && !voided ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive h-9 gap-1.5 rounded-xl"
            onClick={() => setVoidOpen(true)}
          >
            <Ban className="size-3.5" />
            {t("voidAction")}
          </Button>
        ) : null}
      </div>
    </div>
  );

  const voidBanner = voided ? (
    <div className="border-destructive/30 bg-destructive/10 text-destructive flex items-start gap-2.5 rounded-2xl border p-3.5">
      <Ban className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 text-sm">
        <p className="font-bold">{t("voidedBannerTitle")}</p>
        <p className="text-destructive/90">
          {t("voidedBannerBody", {
            reason: detail.voidReason ?? "—",
            name: detail.voidedByName ?? "—",
            date: detail.voidedAt ? formatDate(detail.voidedAt, { locale, preset: "long" }) : "—",
          })}
        </p>
      </div>
    </div>
  ) : null;

  const voidDialog = (
    <VoidPurchaseDialog purchaseId={detail.id} open={voidOpen} onOpenChange={setVoidOpen} />
  );

  if (variant === "modal") {
    return (
      <div className="max-h-[85dvh] space-y-5 overflow-y-auto p-5">
        {header}
        {voidBanner}
        {customerBlock}
        {transactionBlock}
        {itemsBlock}
        {redeemBlock}
        {breakdownBlock}
        {loyaltyBlock}
        {timelineBlock}
        {voidDialog}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}
      {voidBanner}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {itemsBlock}
          {redeemBlock}
          {breakdownBlock}
          {timelineBlock}
        </div>
        <div className="space-y-5">
          {customerBlock}
          {transactionBlock}
          {loyaltyBlock}
        </div>
      </div>
      {voidDialog}
    </div>
  );
}

function initials(name: string | null): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function Section({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
        {icon}
        {label}
      </p>
      {children}
    </section>
  );
}

function CustomerBlock({ detail }: { detail: PurchaseAdminDetail }) {
  const t = useTranslations("Purchases");
  const format = useFormatter();
  const now = useNow();
  const c = detail.customer;
  const tierKey = (TIER_KEYS as readonly string[]).includes(c.tierKey ?? "")
    ? (c.tierKey as (typeof TIER_KEYS)[number])
    : "hoja";

  return (
    <Section icon={<UserIcon className="size-3.5" />} label={t("customer")}>
      <Link
        href={{ pathname: "/customers/[id]", params: { id: c.id } }}
        className="border-border hover:bg-muted/40 flex items-center gap-3 rounded-2xl border p-3.5 transition-colors"
      >
        <span className="bg-primary/10 text-primary grid size-10 flex-none place-items-center rounded-full text-sm font-bold">
          {initials(c.name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-foreground truncate text-sm font-bold">
            {c.name ?? c.phone}
          </span>
          <span className="text-muted-foreground truncate text-xs">
            {t("memberSince", { since: format.relativeTime(c.memberSince, now) })}
          </span>
        </div>
        <Badge variant="outline">{t(`tier.${tierKey}`)}</Badge>
        <ChevronRight className="text-muted-foreground/50 size-4 shrink-0" />
      </Link>
    </Section>
  );
}

function TransactionBlock({ detail }: { detail: PurchaseAdminDetail }) {
  const t = useTranslations("Purchases");
  const locale = useLocale();

  return (
    <Section icon={<Receipt className="size-3.5" />} label={t("transaction")}>
      <dl className="text-sm">
        <Row label={t("txId")}>
          <span className="inline-flex items-center gap-1 font-mono text-xs">
            <Hash className="size-3" />
            {detail.idempotencyKey}
          </span>
        </Row>
        <Row label={t("txDate")}>{formatDate(detail.createdAt, { locale, preset: "long" })}</Row>
        <Row label={t("txStore")}>
          {detail.storeId && detail.storeName ? (
            <Link
              href={{ pathname: "/stores/[id]", params: { id: detail.storeId } }}
              className="text-primary inline-flex items-center gap-1 font-semibold hover:underline"
            >
              <StoreIcon className="size-3.5" />
              {detail.storeName}
            </Link>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </Row>
        <Row label={t("txCashier")}>
          {detail.cashierName ?? <span className="text-muted-foreground">—</span>}
        </Row>
        <Row label={t("txAttribution")}>
          {detail.promo ? (
            <Link
              href={{ pathname: "/promotions/[id]", params: { id: detail.promo.promoId } }}
              className="text-primary inline-flex items-center gap-1 font-semibold hover:underline"
            >
              <Tag className="size-3.5" />
              {detail.promo.name ?? t("promoApplied")}
            </Link>
          ) : detail.entrySource === "campaign" && detail.attributionCampaignId ? (
            <Link
              href={{ pathname: "/campaigns/[id]", params: { id: detail.attributionCampaignId } }}
              className="text-primary inline-flex items-center gap-1 font-semibold hover:underline"
            >
              <Megaphone className="size-3.5" />
              {t("entry.campaign")}
            </Link>
          ) : detail.entrySource === "campaign" ? (
            <span className="inline-flex items-center gap-1">
              <Megaphone className="size-3.5" />
              {t("entry.campaign")}
            </span>
          ) : detail.entrySource === "shortlink" ? (
            t("entry.shortlink")
          ) : (
            <span className="text-muted-foreground">{t("organic")}</span>
          )}
        </Row>
      </dl>
    </Section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-border/60 flex items-center justify-between gap-3 border-b py-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  );
}

function ItemsBlock({ items }: { items: PurchaseAdminDetail["items"] }) {
  const t = useTranslations("Purchases");
  const format = useFormatter();

  return (
    <Section icon={<Receipt className="size-3.5" />} label={t("items")}>
      <div className="bg-card border-border divide-border/60 divide-y rounded-2xl border">
        {items.map((item) => {
          const parts = [item.variantLabel, ...item.modifierLabels].filter(Boolean);
          const inner = (
            <>
              <span className="bg-muted text-muted-foreground grid h-7 min-w-7 flex-none place-items-center rounded-lg px-1.5 text-sm font-extrabold">
                {item.qty}×
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-foreground truncate text-sm font-semibold">
                  {item.name ?? "—"}
                </span>
                {parts.length > 0 ? (
                  <span className="text-muted-foreground truncate text-xs">{parts.join(" · ")}</span>
                ) : null}
              </div>
              <span className="text-foreground text-sm font-bold">
                {money(format, item.unitAmountCents * item.qty)}
              </span>
            </>
          );
          return item.name ? (
            <Link
              key={item.id}
              href={{ pathname: "/products/[id]", params: { id: item.productId } }}
              className="hover:bg-muted/40 flex items-center gap-3 px-3.5 py-2.5 transition-colors"
            >
              {inner}
            </Link>
          ) : (
            <div key={item.id} className="flex items-center gap-3 px-3.5 py-2.5">
              {inner}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function RedeemBlock({ reward }: { reward: NonNullable<PurchaseAdminDetail["reward"]> }) {
  const t = useTranslations("Purchases");

  return (
    <Section icon={<Gift className="size-3.5" />} label={t("rewardRedeemed")}>
      <Link
        href={{ pathname: "/rewards/[id]", params: { id: reward.rewardId } }}
        className="border-border hover:bg-muted/40 flex items-center gap-3 rounded-2xl border p-3.5 transition-colors"
      >
        <span className="bg-primary/10 text-primary grid size-10 flex-none place-items-center overflow-hidden rounded-xl">
          {reward.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={reward.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <Gift className="size-5" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-foreground truncate text-sm font-bold">{reward.name ?? "—"}</span>
          <span className="text-muted-foreground text-xs font-semibold">
            {reward.currency === "stamps"
              ? t("spentStamps", { count: reward.stampsSpent })
              : t("spentPoints", { count: reward.pointsSpent })}
          </span>
        </div>
        <ChevronRight className="text-muted-foreground/50 size-4 shrink-0" />
      </Link>
    </Section>
  );
}

function BreakdownBlock({
  detail,
  promoShare,
  rewardShare,
  amountOnly,
}: {
  detail: PurchaseAdminDetail;
  promoShare: number;
  rewardShare: number;
  amountOnly: boolean;
}) {
  const t = useTranslations("Purchases");
  const format = useFormatter();
  const cur = detail.currency;

  return (
    <Section icon={<Tag className="size-3.5" />} label={t("breakdown")}>
      <div className="bg-card border-border space-y-2 rounded-2xl border p-4 text-sm">
        {!amountOnly && detail.subtotalCents != null ? (
          <div className="text-muted-foreground flex items-center justify-between">
            <span>{t("subtotal")}</span>
            <span className="text-foreground font-semibold">
              {money(format, detail.subtotalCents, cur)}
            </span>
          </div>
        ) : null}
        {detail.promo && promoShare > 0 ? (
          <div className="text-primary flex items-center justify-between font-semibold">
            <span className="truncate">{t("promoLine", { name: detail.promo.name ?? "" })}</span>
            <span>−{money(format, promoShare, cur)}</span>
          </div>
        ) : null}
        {detail.reward && rewardShare > 0 ? (
          <div className="text-primary flex items-center justify-between font-semibold">
            <span className="truncate">{t("rewardLine", { name: detail.reward.name ?? "" })}</span>
            <span>−{money(format, rewardShare, cur)}</span>
          </div>
        ) : null}
        <div className="border-border flex items-center justify-between border-t pt-2">
          <span className="text-foreground font-extrabold">{t("total")}</span>
          <span className="font-display text-foreground text-lg font-semibold">
            {money(format, detail.totalCents, cur)}
          </span>
        </div>
      </div>
    </Section>
  );
}

function LoyaltyBlock({ detail }: { detail: PurchaseAdminDetail }) {
  const t = useTranslations("Purchases");
  const voided = detail.voidedAt != null;
  const isOwner = useHasRole("owner") && !voided;
  const [adjustOpen, setAdjustOpen] = useState(false);

  // For a voided sale show what it originally granted (now reverted): keep the
  // numbers readable (muted) with a clear "reverted" caption underneath.
  const stampsShown = voided ? (detail.reversal?.stamps ?? detail.stampsEarned) : detail.stampsEarned;
  const pointsShown = voided ? (detail.reversal?.points ?? detail.pointsEarned) : detail.pointsEarned;
  const tileValue = voided ? "text-muted-foreground" : "text-primary";
  const tileBg = voided ? "bg-muted" : "bg-primary/10";
  const tileLabel = voided ? "text-muted-foreground" : "text-primary/80";

  return (
    <Section icon={<Gift className="size-3.5" />} label={t("loyaltyImpact")}>
      <div className="flex gap-3">
        <div className={`${tileBg} flex-1 rounded-2xl p-3.5 text-center`}>
          <div className={`font-display text-2xl font-semibold ${tileValue}`}>
            🧋 +{stampsShown}
          </div>
          <div className={`mt-1 text-xs font-bold ${tileLabel}`}>{t("stampsEarned")}</div>
        </div>
        <div className={`${tileBg} flex-1 rounded-2xl p-3.5 text-center`}>
          <div className={`font-display text-2xl font-semibold ${tileValue}`}>+{pointsShown}</div>
          <div className={`mt-1 text-xs font-bold ${tileLabel}`}>{t("pointsEarned")}</div>
        </div>
      </div>
      {voided ? (
        <p className="text-destructive flex items-center gap-1.5 text-xs font-semibold">
          <Ban className="size-3.5" />
          {t("loyaltyReverted")}
        </p>
      ) : null}
      {isOwner ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-1 h-9 w-full rounded-xl"
            onClick={() => setAdjustOpen(true)}
          >
            <Pencil className="size-3.5" />
            {t("adjustPoints")}
          </Button>
          <AdjustPointsDialog
            purchaseId={detail.id}
            open={adjustOpen}
            onOpenChange={setAdjustOpen}
          />
        </>
      ) : null}
    </Section>
  );
}

function TimelineBlock({ detail }: { detail: PurchaseAdminDetail }) {
  const t = useTranslations("Purchases");
  const locale = useLocale();

  const labelFor = (e: PurchaseAdminDetail["timeline"][number]): string => {
    switch (e.kind) {
      case "sale":
        return e.actorName ? t("timelineSaleBy", { name: e.actorName }) : t("timelineSale");
      case "stamp":
        return t("timelineStamp", { count: e.amount ?? 0 });
      case "points":
        return t("timelinePoints", { count: e.amount ?? 0 });
      case "redeem":
        return t("timelineRedeem", { name: e.rewardName ?? "" });
      case "adjust": {
        const signed = (e.amount ?? 0) > 0 ? `+${e.amount}` : `${e.amount}`;
        return e.actorName
          ? t("timelineAdjustBy", { points: signed, name: e.actorName })
          : t("timelineAdjust", { points: signed });
      }
      case "void":
        return e.actorName
          ? t("timelineVoidBy", { name: e.actorName })
          : t("timelineVoid");
      default:
        return "";
    }
  };

  return (
    <Section icon={<Clock className="size-3.5" />} label={t("timeline")}>
      <ol className="border-border relative ml-2 space-y-3 border-l pl-5">
        {detail.timeline.map((e, i) => (
          <li key={`${e.kind}-${i}`} className="relative">
            <span
              className={`absolute top-1 -left-[1.4rem] size-2.5 rounded-full ring-4 ring-[var(--color-card)] ${e.kind === "void" ? "bg-destructive" : "bg-primary"}`}
            />
            <p className={`text-sm font-medium ${e.kind === "void" ? "text-destructive" : ""}`}>
              {labelFor(e)}
            </p>
            {e.reason ? (
              <p className="text-muted-foreground text-xs italic">“{e.reason}”</p>
            ) : null}
            <p className="text-muted-foreground text-xs">
              {formatDate(e.at, { locale, preset: "long" })}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

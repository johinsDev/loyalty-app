"use client";

import { formatDate } from "@loyalty/date";
import {
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { ChevronRight, Gift, Tag } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { CountUp } from "@/lib/count-up";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { money } from "@/features/menu/components/product-card";

import type {
  PurchaseDetail,
  PurchaseDetailItem,
} from "../types";

/**
 * Itemized purchase detail — the receipt. Rendered both as a full page
 * (`variant="page"`, on direct load / share) and inside the intercepting modal
 * (`variant="modal"`). Mirrors the history `ReceiptSheet` layout: header with
 * date + cashier, the (clickable) line items, the applied promo and inline
 * reward blocks, subtotal / discount / total, and the stamps + points earned.
 * Amount-only sales (no items) collapse to a single total. Client component.
 */
export function PurchaseDetailView({
  detail,
  variant = "page",
}: {
  detail: PurchaseDetail;
  variant?: "page" | "modal";
}) {
  const t = useTranslations("Purchases");
  const locale = useLocale();
  const format = useFormatter();
  const reduced = useReducedMotion();

  const amountOnly = detail.items.length === 0;

  return (
    <div className={variant === "page" ? "px-2 pt-2 pb-6" : "px-2 pb-6"}>
      <ResponsiveModalHeader className="items-center text-center">
        <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
          {money(format, detail.totalCents, detail.currency)}
        </ResponsiveModalTitle>
        <p className="text-muted-foreground text-sm">
          {formatDate(detail.createdAt, { locale, preset: "long" })}
        </p>
        {detail.cashierName ? (
          <p className="text-muted-foreground/70 text-xs">
            {t("cashier", { name: detail.cashierName })}
          </p>
        ) : null}
      </ResponsiveModalHeader>

      {amountOnly ? (
        <p className="text-muted-foreground px-4 text-center text-sm">
          {t("amountOnly")}
        </p>
      ) : (
        <div className="flex flex-col gap-3 px-4">
          {detail.items.map((item, i) => (
            <ItemRow key={item.id} item={item} index={i} reduced={reduced} />
          ))}
        </div>
      )}

      {detail.promo ? (
        <PromoBlock promo={detail.promo} currency={detail.currency} />
      ) : null}

      {detail.reward ? <RewardBlock reward={detail.reward} /> : null}

      <div className="border-border my-4 border-t border-dashed" />

      <div className="px-4">
        {!amountOnly && detail.subtotalCents != null ? (
          <div className="text-muted-foreground mb-2 flex items-center justify-between text-sm">
            <span>{t("subtotal")}</span>
            <span className="text-foreground font-semibold">
              {money(format, detail.subtotalCents, detail.currency)}
            </span>
          </div>
        ) : null}
        {detail.discountCents > 0 ? (
          <div className="text-primary mb-2 flex items-center justify-between text-sm font-semibold">
            <span>{t("discount")}</span>
            <span>−{money(format, detail.discountCents, detail.currency)}</span>
          </div>
        ) : null}
        <div className="mb-4 flex items-center justify-between">
          <span className="text-foreground text-base font-extrabold">
            {t("total")}
          </span>
          <span className="font-display text-foreground text-2xl font-semibold">
            {money(format, detail.totalCents, detail.currency)}
          </span>
        </div>

        <div className="flex gap-3">
          <div className="bg-primary/10 flex-1 rounded-2xl p-3.5 text-center">
            <div className="font-display text-primary text-2xl font-semibold">
              🧋 <CountUp value={detail.stampsEarned} plus className="text-primary" />
            </div>
            <div className="text-primary/80 mt-1 text-xs font-bold">
              {t("stampsEarned")}
            </div>
          </div>
          <div className="bg-primary/10 flex-1 rounded-2xl p-3.5 text-center">
            <CountUp
              value={detail.pointsEarned}
              plus
              className="font-display text-primary text-2xl font-semibold"
            />
            <div className="text-primary/80 mt-1 text-xs font-bold">
              {t("pointsEarned")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemRow({
  item,
  index,
  reduced,
}: {
  item: PurchaseDetailItem;
  index: number;
  reduced: boolean;
}) {
  const format = useFormatter();

  const detailParts = [
    item.variantLabel,
    ...item.modifierLabels,
  ].filter(Boolean);

  const style = reduced
    ? undefined
    : {
        animation: "tw-fade-up 0.4s ease-out backwards",
        animationDelay: `${index * 60}ms`,
      };

  const inner = (
    <>
      <span className="bg-muted text-muted-foreground grid h-7 min-w-7 flex-none place-items-center rounded-lg px-1.5 text-sm font-extrabold">
        {item.qty}×
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-foreground truncate text-[0.95rem] font-semibold">
          {item.name ?? "—"}
        </span>
        {detailParts.length > 0 ? (
          <span className="text-muted-foreground truncate text-xs">
            {detailParts.join(" · ")}
          </span>
        ) : null}
      </div>
      <span className="text-foreground text-[0.95rem] font-bold">
        {money(format, item.unitAmountCents * item.qty)}
      </span>
    </>
  );

  if (item.slug) {
    return (
      <Link
        href={{ pathname: "/product/[slug]", params: { slug: item.slug } }}
        style={style}
        className="hover:bg-muted/40 -mx-2 flex items-start gap-3 rounded-2xl px-2 py-1 transition-colors"
      >
        {inner}
      </Link>
    );
  }
  return (
    <div style={style} className="-mx-2 flex items-start gap-3 px-2 py-1">
      {inner}
    </div>
  );
}

function PromoBlock({
  promo,
  currency,
}: {
  promo: NonNullable<PurchaseDetail["promo"]>;
  currency: string;
}) {
  const t = useTranslations("Purchases");
  const format = useFormatter();

  return (
    <div className="mt-4 px-4">
      <Link
        href="/promos"
        className="border-border hover:bg-muted/40 flex items-center gap-3 rounded-2xl border p-3.5 transition-colors"
      >
        <span className="bg-primary/10 text-primary grid size-10 flex-none place-items-center rounded-xl">
          <Tag className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-muted-foreground text-[0.6875rem] font-bold tracking-wide">
            {t("promoApplied")}
          </span>
          <span className="text-foreground truncate text-sm font-bold">
            {promo.name ?? "—"}
          </span>
          <span className="text-primary text-xs font-semibold">
            {promo.freeItemLabel
              ? promo.freeItemLabel
              : `−${money(format, promo.discountCents, currency)}`}
          </span>
        </div>
        <ChevronRight className="text-muted-foreground/50 size-4 shrink-0" />
      </Link>
    </div>
  );
}

function RewardBlock({
  reward,
}: {
  reward: NonNullable<PurchaseDetail["reward"]>;
}) {
  const t = useTranslations("Purchases");

  return (
    <div className="mt-3 px-4">
      <Link
        href="/rewards"
        className="border-border hover:bg-muted/40 flex items-center gap-3 rounded-2xl border p-3.5 transition-colors"
      >
        <span className="bg-primary/10 text-primary grid size-10 flex-none place-items-center overflow-hidden rounded-xl">
          {reward.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={reward.imageUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <Gift className="size-5" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-muted-foreground text-[0.6875rem] font-bold tracking-wide">
            {t("rewardRedeemed")}
          </span>
          <span className="text-foreground truncate text-sm font-bold">
            {reward.name ?? "—"}
          </span>
          <span className="text-muted-foreground text-xs font-semibold">
            {reward.currency === "stamps"
              ? t("spentStamps", { count: reward.stampsSpent })
              : t("spentPoints", { count: reward.pointsSpent })}
          </span>
        </div>
        <ChevronRight className="text-muted-foreground/50 size-4 shrink-0" />
      </Link>
    </div>
  );
}

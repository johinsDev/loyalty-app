"use client";

import {
  Button,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { Store } from "lucide-react";
import { useTranslations } from "next-intl";

export type ConfirmLine = { key: string; name: string; qty: number; amountCents: number };
export type ConfirmDiscount = { label: string; amountCents: number };

/**
 * The last look before an irreversible sale. Recording used to fire straight off
 * the register button, so a mistyped amount or a wrong line was charged with no
 * chance to catch it — and there is still no way to void a purchase.
 *
 * Everything shown comes from the register's own `stamps.preview`, the same
 * server-authoritative numbers the cart draws, so this can't disagree with what
 * gets charged.
 *
 * The "no store" warning lives here rather than in a second overlay: chaining
 * two dialogs that ask the same question turns the second one into reflex.
 */
export function ConfirmSale({
  open,
  onOpenChange,
  onConfirm,
  pending,
  customerName,
  lines,
  subtotalCents,
  discounts,
  totalCents,
  earned,
  hasStore,
  formatMoney,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
  customerName: string;
  /** Empty in "total" mode — the cashier typed an amount, there are no lines. */
  lines: ConfirmLine[];
  subtotalCents: number | null;
  discounts: ConfirmDiscount[];
  totalCents: number;
  earned: { stamps: number; points: number } | null;
  hasStore: boolean;
  formatMoney: (cents: number) => string;
}) {
  const t = useTranslations("Cashier");
  const willEarn = earned && (earned.stamps > 0 || earned.points > 0);

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
        <div className="flex flex-col px-6 pt-2 pb-6">
          <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
            {t("confirmSaleTitle")}
          </ResponsiveModalTitle>
          <p className="text-muted-foreground mt-1 text-sm font-semibold">
            {t("confirmSaleFor", { name: customerName })}
          </p>

          {lines.length > 0 ? (
            <ul className="border-border mt-4 max-h-52 space-y-1 overflow-y-auto border-t pt-3 text-sm">
              {lines.map((l) => (
                <li key={l.key} className="flex items-baseline gap-2">
                  <span className="text-muted-foreground w-6 flex-none font-bold tabular-nums">
                    {l.qty}×
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{l.name}</span>
                  <span className="flex-none font-semibold tabular-nums">
                    {formatMoney(l.amountCents)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="border-border mt-3 border-t pt-3 text-sm">
            {subtotalCents != null ? (
              <div className="text-muted-foreground flex justify-between font-semibold">
                <span>{t("subtotal")}</span>
                <span className="tabular-nums">{formatMoney(subtotalCents)}</span>
              </div>
            ) : null}
            {discounts.map((d) => (
              <div
                key={d.label}
                className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400"
              >
                <span className="min-w-0 truncate pr-2">{d.label}</span>
                <span className="flex-none tabular-nums">− {formatMoney(d.amountCents)}</span>
              </div>
            ))}
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-bold">{t("net")}</span>
              <span className="font-display text-2xl font-bold tabular-nums">
                {formatMoney(totalCents)}
              </span>
            </div>
            {willEarn ? (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs font-bold">
                <span className="text-muted-foreground">{t("willEarn")}</span>
                {earned.stamps > 0 ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">
                    +{earned.stamps} {t("stampMany")}
                  </span>
                ) : null}
                {earned.points > 0 ? (
                  <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5">
                    +{earned.points} {t("earnPtsUnit")}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          {!hasStore ? (
            <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5">
              <Store className="mt-0.5 size-4 flex-none text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                {t("storelessBody")}
              </p>
            </div>
          ) : null}

          <div className="mt-6 flex gap-2">
            <Button
              variant="secondary"
              onClick={() => onOpenChange(false)}
              className="h-10 flex-1 rounded-2xl font-bold"
            >
              {t("confirmSaleCancel")}
            </Button>
            <Button
              variant="default"
              disabled={pending}
              onClick={onConfirm}
              className="h-10 flex-1 rounded-2xl font-extrabold"
            >
              {pending ? t("confirmSalePending") : t("confirmSaleConfirm")}
            </Button>
          </div>
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

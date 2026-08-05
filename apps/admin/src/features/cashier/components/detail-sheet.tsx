"use client";

import {
  Button,
  cn,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { CASHIER, LABEL, LABEL_BASE } from "./chrome";

/**
 * What the cashier needs to know about a promo or a reward, ranked.
 *
 * `apply` turns the sheet into a decision instead of a dead end: the cashier
 * reads what the reward does and redeems it without hunting back for the row.
 * Absent for promo details, which have no equivalent commit step.
 */
export type CashierDetail = {
  title: string;
  /** Promo details stay a plain paragraph list. */
  lines: string[];
  /** Reward details are structured so the sheet can rank them: what it gives
   *  reads as the headline, what qualifies as chips, the rest as support.
   *  Flattening all of it into `lines` rendered one wall of identical text. */
  benefit?: string | null;
  scope?: string[];
  cost?: string | null;
  note?: string | null;
  /** Upsell only: the step that unlocks the promo, spelled out. */
  how?: string | null;
  warning?: string | null;
  apply?: { label: string; disabled?: boolean; run: () => void };
};

/**
 * The one way a promo or reward is explained at the counter.
 *
 * It used to exist twice: this version, in the register, and a much thinner one
 * in the Premios tab that showed a title, two badges and a description — and
 * dropped the cost that its own list rows displayed. So the same reward read
 * differently depending on which tab the cashier opened it from. This is the
 * register's version, lifted out unchanged; only the scope chips' behaviour is
 * now injected, because "tap a chip to point the catalog at it" is something
 * only the register can do.
 */
export function CashierDetailSheet({
  detail,
  onClose,
  onScopeClick,
  scopeIcon,
}: {
  detail: CashierDetail | null;
  onClose: () => void;
  /** The register points its catalog at the tapped item; the Premios tab, which
   *  has no cart to add to, leaves the chips as plain labels. */
  onScopeClick?: (label: string) => void;
  scopeIcon?: (label: string) => ReactNode;
}) {
  const t = useTranslations("Cashier");
  const interactive = Boolean(onScopeClick);

  return (
    <ResponsiveModal open={detail !== null} onOpenChange={(o) => !o && onClose()}>
      <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-sm">
        <div className="flex flex-col px-6 pt-2 pb-6">
          <ResponsiveModalTitle className="font-display text-xl font-semibold tracking-tight">
            {detail?.title}
          </ResponsiveModalTitle>
          {/* What it gives, first and largest — it's the sentence the cashier
              repeats to the customer. Everything else supports it. */}
          {detail?.benefit ? (
            <p className="text-primary mt-2 text-lg leading-snug font-extrabold">
              {detail.benefit}
            </p>
          ) : null}

          {detail?.cost ? (
            <div className="mt-2.5">
              <span className="bg-primary/10 text-primary inline-block rounded-full px-2.5 py-1 text-xs font-extrabold">
                {detail.cost}
              </span>
            </div>
          ) : null}

          <div className="mt-3 space-y-2">
            {/* Index-keyed: two lines can legitimately be the same string, and
                a bare `key={l}` dropped the duplicate. */}
            {detail?.lines.map((l, i) => (
              <p key={`${i}-${l}`} className="text-muted-foreground text-sm leading-relaxed">
                {l}
              </p>
            ))}
            {!detail?.benefit && (detail?.lines ?? []).length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("noDetail")}</p>
            ) : null}
          </div>

          {/* Chips, not a comma list: the cashier is scanning for one name.
              In the register, tapping one points the menu at it — a category
              filters the grid, a product searches for it — because the next
              thing the cashier does with "needs a Classic Milk Tea" is add one.
              Navigating to a product page would have cost them the cart. */}
          {(detail?.scope ?? []).length > 0 ? (
            <div className="border-border mt-4 border-t pt-3.5">
              <p className={LABEL}>{t("rewardScopeLabel")}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail?.scope?.map((s) => {
                  const content = (
                    <>
                      {scopeIcon?.(s)}
                      {s}
                    </>
                  );
                  const shared =
                    "text-foreground flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold";
                  return interactive ? (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        onScopeClick?.(s);
                        onClose();
                      }}
                      className={`bg-muted hover:bg-primary/10 hover:text-primary transition-colors ${shared}`}
                    >
                      {content}
                    </button>
                  ) : (
                    <span key={s} className={`bg-muted ${shared}`}>
                      {content}
                    </span>
                  );
                })}
              </div>
              {interactive ? (
                <p className="text-muted-foreground/70 mt-2 text-[0.6875rem] font-semibold">
                  {t("rewardScopeHint")}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Upsell: the step that unlocks the promo, stated as an action. */}
          {detail?.how ? (
            <div className="border-primary/25 bg-primary/5 mt-3.5 rounded-xl border px-3.5 py-2.5">
              <p className={cn(LABEL_BASE, "text-primary/70")}>{t("upsellHowLabel")}</p>
              <p className="text-foreground mt-1 text-sm font-semibold">{detail.how}</p>
            </div>
          ) : null}

          {detail?.note ? (
            <div className="border-border mt-3.5 rounded-xl border border-dashed px-3.5 py-2.5">
              <p className={LABEL}>{t("rewardFulfillmentLabel")}</p>
              <p className="text-foreground mt-1 text-sm font-semibold">{detail.note}</p>
            </div>
          ) : null}

          {detail?.warning ? (
            <p className="mt-3.5 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 text-sm font-semibold text-amber-700 dark:text-amber-400">
              {detail.warning}
            </p>
          ) : null}
          {detail?.apply ? (
            <Button
              size="lg"
              disabled={detail.apply.disabled}
              onClick={() => {
                detail.apply?.run();
                onClose();
              }}
              className={`mt-5 w-full rounded-2xl text-base font-extrabold ${CASHIER.control}`}
            >
              {detail.apply.label}
            </Button>
          ) : null}
        </div>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

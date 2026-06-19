"use client";

import {
  Badge,
  Button,
  ResponsiveModal,
  ResponsiveModalClose,
  ResponsiveModalContent,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { Check, Layers, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseAsBoolean, useQueryState } from "nuqs";

import { currentTier, stampsBalance, tiers } from "../data";

/**
 * "Ver todos los niveles y condiciones" — a trigger button plus a bottom Drawer
 * that lists every tier with its threshold, benefits and fine print, marking the
 * one the customer is on and locking the ones still ahead. The open state lives
 * in the URL (`?levels=1`) via nuqs, so the reward detail (and a shared link) can
 * open it too. Rendered once inside the tier card.
 */
export function AllLevelsSheet() {
  const t = useTranslations("Rewards");
  const [open, setOpen] = useQueryState("levels", parseAsBoolean.withDefault(false));
  const current = currentTier();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="bg-card/70 h-10 w-full rounded-full text-sm font-bold"
        onClick={() => void setOpen(true)}
      >
        <Layers className="size-4" />
        {t("viewAllLevels")}
      </Button>

      <ResponsiveModal
        open={open}
        onOpenChange={(next) => void setOpen(next ? true : null)}
      >
        <ResponsiveModalContent mobileClassName="mx-auto w-full max-w-md">
          <ResponsiveModalHeader className="items-center gap-1 text-center">
            <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
              {t("allLevelsTitle")}
            </ResponsiveModalTitle>
            <ResponsiveModalDescription className="text-[0.9375rem] leading-relaxed">
              {t("allLevelsSubtitle")}
            </ResponsiveModalDescription>
          </ResponsiveModalHeader>

          <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-2">
            {tiers.map((tier) => {
              const isCurrent = tier.key === current.key;
              const locked = stampsBalance < tier.at;
              return (
                <li
                  key={tier.key}
                  className={`rounded-2xl border p-4 ${
                    isCurrent
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card"
                  } ${locked ? "opacity-70" : ""}`}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-display text-foreground text-lg font-semibold tracking-tight">
                      {tier.emoji} {tier.name}
                    </span>
                    {isCurrent ? (
                      <Badge className="rounded-full px-2.5 py-0.5 text-[0.625rem] font-extrabold tracking-wider">
                        {t("levelCurrent")}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs font-bold whitespace-nowrap">
                        {locked ? <Lock className="size-3.5" /> : <Check className="size-3.5" />}
                        {t("levelFrom", { count: tier.at })}
                      </span>
                    )}
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {tier.benefits.map((benefit) => (
                      <li
                        key={benefit}
                        className="text-foreground flex items-center gap-2 text-sm"
                      >
                        <Check className="text-primary size-3.5 shrink-0" />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                  <p className="text-muted-foreground mt-2.5 text-xs leading-relaxed">
                    {tier.conditions}
                  </p>
                </li>
              );
            })}
          </ul>

          <ResponsiveModalFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <ResponsiveModalClose className="w-full sm:w-auto">
              {t("close")}
            </ResponsiveModalClose>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </>
  );
}

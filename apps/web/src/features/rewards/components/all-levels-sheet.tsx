"use client";

import {
  Badge,
  Button,
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
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

      <Drawer open={open} onOpenChange={(next) => void setOpen(next ? true : null)}>
        <DrawerContent className="mx-auto w-full max-w-md lg:max-w-lg">
          <DrawerHeader className="items-center gap-1 text-center">
            <DrawerTitle className="font-display text-2xl font-semibold tracking-tight">
              {t("allLevelsTitle")}
            </DrawerTitle>
            <DrawerDescription className="text-[0.9375rem] leading-relaxed">
              {t("allLevelsSubtitle")}
            </DrawerDescription>
          </DrawerHeader>

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

          <div className="shrink-0 px-5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
            <DrawerClose asChild>
              <Button
                variant="secondary"
                size="lg"
                className="w-full rounded-full font-semibold"
              >
                {t("close")}
              </Button>
            </DrawerClose>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

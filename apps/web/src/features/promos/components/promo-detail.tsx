"use client";

import {
  Button,
  ResponsiveModalClose,
  ResponsiveModalDescription,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { Clock, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { PROMO_THEME, type Promo, promoGradient } from "../data";

/**
 * Detail of a single promo, rendered inside the catalog's bottom Drawer: the
 * tinted icon, name, effect + validity, description, the register code with a
 * copy-to-clipboard action, the terms, and a "show at register" CTA.
 */
export function PromoDetail({ promo }: { promo: Promo }) {
  const t = useTranslations("Promos");
  const Icon = promo.icon;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(promo.code);
      toast.success(t("codeCopied"));
    } catch {
      toast.error(t("codeCopyFailed"));
    }
  };

  return (
    <div className="flex flex-col items-center px-6 pb-2 text-center">
      <span
        className="mt-2 grid size-24 place-items-center rounded-[1.75rem] shadow-lg shadow-black/5"
        style={{ backgroundImage: promoGradient(PROMO_THEME[promo.theme].tint) }}
      >
        <Icon className="size-11 text-[#000323]" />
      </span>
      <ResponsiveModalHeader className="items-center gap-2">
        <ResponsiveModalTitle className="font-display text-2xl font-semibold tracking-tight">
          {promo.name}
        </ResponsiveModalTitle>
        <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold">
          {promo.badge}
          <span aria-hidden>·</span>
          <Clock className="size-3.5" />
          {promo.validity}
        </span>
        <ResponsiveModalDescription className="text-[0.9375rem] leading-relaxed">
          {promo.description}
        </ResponsiveModalDescription>
      </ResponsiveModalHeader>

      <div className="border-primary/40 bg-primary/5 mt-1 flex w-full items-center gap-3 rounded-2xl border border-dashed p-4">
        <div className="min-w-0 flex-1 text-left">
          <div className="text-muted-foreground text-[0.6875rem] font-extrabold tracking-wider">
            {t("code")}
          </div>
          <div className="font-display text-foreground truncate text-xl font-semibold tracking-wide">
            {promo.code}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={copyCode}
          className="shrink-0 rounded-full font-bold"
        >
          <Copy className="size-4" />
          {t("copy")}
        </Button>
      </div>

      <p className="bg-muted/60 text-muted-foreground mt-4 w-full rounded-2xl p-4 text-left text-xs leading-relaxed">
        {t("terms")}
      </p>

      <ResponsiveModalFooter className="w-full gap-2 px-0">
        <ResponsiveModalClose variant="gradient" className="w-full sm:w-auto">
          {t("showAtRegister")}
        </ResponsiveModalClose>
        <ResponsiveModalClose className="w-full sm:w-auto">
          {t("close")}
        </ResponsiveModalClose>
      </ResponsiveModalFooter>
    </div>
  );
}

"use client";

import { Ticket } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";

import type { PromoDetailData } from "../types";

/**
 * Shared promo detail — rendered inside the intercepted modal and on the full
 * `/promo/[slug]` page. Background + optional main image, badge, the long
 * (tiptap) description as `prose`, and a "show at the register" note (the promo
 * is applied at checkout by the cashier).
 */
export function PromoDetail({ promo }: { promo: PromoDetailData }) {
  const t = useTranslations("Promos");
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="px-4 pt-4 sm:px-6">
        <div
          className="relative h-48 w-full shrink-0 overflow-hidden rounded-3xl lg:h-60"
          style={{ background: promo.backgroundCss ?? "var(--muted)" }}
        >
          {promo.mainImageUrl ? (
            <Image
              src={promo.mainImageUrl}
              alt={promo.name}
              fill
              sizes="(min-width: 1024px) 40rem, 100vw"
              className="object-cover"
              priority
            />
          ) : null}
          {promo.badgeLabel ? (
            <span className="absolute top-4 left-4 inline-flex rounded-full bg-white/25 px-3 py-1 text-xs font-extrabold tracking-wide text-white backdrop-blur-sm">
              {promo.badgeLabel}
            </span>
          ) : null}
        </div>
      </div>

      <div className="px-6 pt-5 pb-8 sm:px-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">{promo.name}</h1>
        {promo.benefitSummary ? (
          <p className="text-primary mt-1 text-sm font-semibold">{promo.benefitSummary}</p>
        ) : null}
        {promo.shortDescription ? (
          <p className="text-muted-foreground mt-1 text-sm">{promo.shortDescription}</p>
        ) : null}

        {promo.longDescription ? (
          <div
            className="prose prose-sm dark:prose-invert text-muted-foreground prose-headings:text-foreground prose-a:text-primary mt-4 max-w-none"
            // Admin-authored tiptap HTML.
            dangerouslySetInnerHTML={{ __html: promo.longDescription }}
          />
        ) : null}

        <div className="border-border mt-6 flex items-start gap-3 rounded-2xl border p-4">
          <Ticket className="text-primary mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-bold">{t("howToUse")}</p>
            <p className="text-muted-foreground mt-0.5 text-sm">{t("showAtRegister")}</p>
          </div>
        </div>

        <div className="pb-[calc(0.5rem+env(safe-area-inset-bottom))]" />
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import type { CSSProperties } from "react";

import { Link } from "@/i18n/navigation";

import { BLUR } from "../blur";
import type { MenuCard } from "../types";
import { FavoriteButton } from "./favorite-button";

export function money(
  format: ReturnType<typeof useFormatter>,
  cents: number,
  currency = "COP",
) {
  return format.number(cents / 100, {
    style: "currency",
    currency,
    // Let Intl pick fraction digits per currency (COP → 0, USD → 2).
    // Spanish omits the separator for 4-digit numbers by default; force it so
    // "2.000 COP" reads consistently with "16.500 COP".
    useGrouping: "always",
  });
}

/** Plain integer via next-intl (e.g. points), grouped consistently. */
export function num(format: ReturnType<typeof useFormatter>, value: number) {
  return format.number(value, { maximumFractionDigits: 0, useGrouping: "always" });
}

/**
 * A product tile linking to `/product/<slug>` (intercepted as a modal from the
 * menu, full SEO page on direct load). Image (next/image + blur), name, price,
 * and the earn preview on its own line so it never crowds the price.
 */
export function ProductCard({
  product,
  featured = false,
  style,
}: {
  product: MenuCard;
  featured?: boolean;
  style?: CSSProperties;
}) {
  const t = useTranslations("Menu");
  const format = useFormatter();

  return (
    <Link
      href={{ pathname: "/product/[slug]", params: { slug: product.slug } }}
      style={style}
      className="bg-card relative flex w-full flex-col overflow-hidden rounded-3xl text-left shadow-lg shadow-black/5 ring-1 ring-black/5 transition-transform active:scale-95 dark:ring-white/10"
    >
      <FavoriteButton productId={product.id} />
      <div className="from-primary/15 to-primary/5 relative grid aspect-[4/3] place-items-center overflow-hidden bg-gradient-to-br">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 16rem, 45vw"
            placeholder="blur"
            blurDataURL={BLUR}
            className="object-cover"
          />
        ) : (
          <span className={featured ? "text-7xl" : "text-5xl"}>🧋</span>
        )}
      </div>
      <div className={`flex flex-col gap-1 ${featured ? "p-4" : "p-3.5"}`}>
        <p
          className={`text-foreground leading-tight font-bold ${
            featured ? "text-lg" : "text-sm"
          }`}
        >
          {product.name}
        </p>
        <span className="font-display text-primary font-semibold tracking-tight">
          {money(format, product.priceCents, product.currency)}
        </span>
        {product.earn.points > 0 ? (
          <span className="text-muted-foreground text-xs font-semibold">
            {t("earnPoints", { points: num(format, product.earn.points) })}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

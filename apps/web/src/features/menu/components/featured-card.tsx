"use client";

import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { BLUR } from "../blur";
import type { SectionView } from "../types";
import { FavoriteButton } from "./favorite-button";
import { money, num } from "./product-card";

/**
 * Destacado — a single featured product as a big, full-width card (image hero +
 * "DESTACADO" label + name + description + price + earn), linking to its detail.
 * Driven by a `featured` section (one product).
 */
export function FeaturedCard({ section }: { section: SectionView }) {
  const t = useTranslations("Menu");
  const format = useFormatter();
  const product = section.products[0];
  if (!product) return null;

  return (
    <Link
      href={{ pathname: "/product/[slug]", params: { slug: product.slug } }}
      className="bg-card relative block overflow-hidden rounded-3xl shadow-lg shadow-black/5 ring-1 ring-black/5 transition-transform active:scale-[0.99] dark:ring-white/10"
    >
      <FavoriteButton productId={product.id} />
      <div className="from-primary/15 to-primary/5 relative h-56 bg-gradient-to-br">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 40rem, 100vw"
            placeholder="blur"
            blurDataURL={BLUR}
            className="object-cover"
          />
        ) : (
          <span className="grid h-full place-items-center text-7xl">🧋</span>
        )}
        <span className="bg-card text-foreground absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-extrabold tracking-wider shadow">
          {t("featured")}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-4">
        <p className="text-foreground font-display text-lg leading-tight font-semibold">
          {product.name}
        </p>
        {product.description ? (
          <p className="text-muted-foreground line-clamp-1 text-sm">
            {product.description}
          </p>
        ) : null}
        <div className="mt-1 flex items-end justify-between">
          <span className="font-display text-primary text-xl font-semibold tracking-tight">
            {money(format, product.priceCents)}
          </span>
          {product.earn.points > 0 ? (
            <span className="text-muted-foreground text-xs font-semibold">
              {t("earnPoints", { points: num(format, product.earn.points) })}
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

"use client";

import Image from "next/image";

import { Link } from "@/i18n/navigation";

import type { PromoCardData } from "../types";

/** A promo card — background (gradient/pattern/image) + badge + name + short
 *  description, linking to the intercepted detail at `/promo/[slug]`. */
export function PromoCard({ promo }: { promo: PromoCardData }) {
  return (
    <Link
      href={{ pathname: "/promos/[slug]", params: { slug: promo.slug } }}
      className="block"
    >
      <div
        className="relative h-44 w-full overflow-hidden rounded-3xl shadow-lg shadow-black/10 ring-1 ring-black/5 transition-transform active:scale-[0.99] lg:h-52 dark:ring-white/10"
        style={{ background: promo.backgroundCss ?? "var(--muted)" }}
      >
        {promo.mainImageUrl ? (
          <Image
            src={promo.mainImageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 640px, 100vw"
            className="object-cover"
          />
        ) : null}
        <div
          className={
            promo.mainImageUrl
              ? "absolute inset-0 bg-gradient-to-r from-black/75 via-black/45 to-black/15"
              : "absolute inset-0 bg-gradient-to-r from-black/35 via-black/10 to-transparent"
          }
        />

        <div className="relative z-10 flex h-full max-w-[72%] flex-col justify-center p-5 text-white">
          {promo.badgeLabel ?? promo.benefitSummary ? (
            <span className="mb-2 inline-flex w-fit max-w-full rounded-full bg-white/25 px-3 py-1 text-xs font-extrabold tracking-wide backdrop-blur-sm">
              <span className="truncate">{promo.badgeLabel ?? promo.benefitSummary}</span>
            </span>
          ) : null}
          <p className="font-display text-xl leading-tight font-semibold drop-shadow-sm">
            {promo.name}
          </p>
          {promo.shortDescription ? (
            <p className="mt-1 line-clamp-2 text-sm text-white/85 drop-shadow-sm">
              {promo.shortDescription}
            </p>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

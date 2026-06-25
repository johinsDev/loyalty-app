"use client";

import { ArrowRight } from "lucide-react";
import Image from "next/image";

import { Link } from "@/i18n/navigation";

import type { BannerCardData } from "../types";
import { CtaLink } from "./cta-link";

/**
 * A home-rail banner. Two visual layers: the `backgroundCss` (gradient | pattern
 * | uploaded image) and an optional foreground `mainImage`. Click behaviour:
 * a banner with a CTA links straight to its target (no detail); without one it
 * opens the intercepted detail at `/banner/[slug]`.
 */
export function BannerCard({ banner }: { banner: BannerCardData }) {
  const inner = (
    <div
      className="group relative h-44 w-full overflow-hidden rounded-3xl shadow-lg shadow-black/10 ring-1 ring-black/5 transition-transform active:scale-[0.99] lg:h-52 dark:ring-white/10"
      style={{ background: banner.backgroundCss ?? "var(--muted)" }}
    >
      {banner.mainImageUrl ? (
        <div className="absolute inset-y-3 right-3 w-2/5">
          <Image
            src={banner.mainImageUrl}
            alt=""
            fill
            sizes="(min-width: 1024px) 240px, 160px"
            className="object-contain object-right"
          />
        </div>
      ) : null}

      {/* Legibility scrim from the left. */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/45 via-black/10 to-transparent" />

      <div className="relative z-10 flex h-full max-w-[62%] flex-col justify-center p-5 text-white">
        <p className="font-display text-xl leading-tight font-semibold drop-shadow-sm">
          {banner.name}
        </p>
        {banner.shortDescription ? (
          <p className="mt-1 line-clamp-2 text-sm text-white/85 drop-shadow-sm">
            {banner.shortDescription}
          </p>
        ) : null}
        {banner.cta ? (
          <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-white/95 px-3.5 py-1.5 text-xs font-bold text-black">
            {banner.cta.label}
            <ArrowRight className="size-3.5" />
          </span>
        ) : null}
      </div>
    </div>
  );

  if (banner.cta) {
    return (
      <CtaLink cta={banner.cta} className="block">
        {inner}
      </CtaLink>
    );
  }
  return (
    <Link
      href={{ pathname: "/banner/[slug]", params: { slug: banner.slug } }}
      className="block"
    >
      {inner}
    </Link>
  );
}

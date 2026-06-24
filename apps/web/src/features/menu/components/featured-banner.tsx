"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";

import { BLUR } from "../blur";
import type { SectionView } from "../types";

/** The featured callout (a `banner` section). Links to its product (opens the
 *  intercepted modal from the menu). */
export function FeaturedBanner({ section }: { section: SectionView }) {
  const t = useTranslations("Menu");
  const b = section.banner;
  if (!b) return null;

  const slug = b.href?.startsWith("/product/")
    ? b.href.slice("/product/".length)
    : null;

  const inner = (
    <div className="from-primary relative overflow-hidden rounded-3xl bg-gradient-to-br to-orange-300 p-5 shadow-lg shadow-primary/20">
      <span className="absolute -top-6 -right-8 size-32 rounded-full bg-white/10" />
      {b.imageUrl ? (
        <Image
          src={b.imageUrl}
          alt=""
          fill
          sizes="(min-width: 1024px) 40rem, 100vw"
          placeholder="blur"
          blurDataURL={BLUR}
          className="object-cover opacity-25"
        />
      ) : null}
      <div className="relative flex items-center gap-4">
        <span className="text-4xl">🌸</span>
        <div className="min-w-0">
          <p className="text-xs font-extrabold tracking-widest text-white/90">
            {t("seasonalTag")}
          </p>
          <p className="font-display text-xl leading-tight font-semibold text-white">
            {b.title}
          </p>
          {b.subtitle ? (
            <p className="truncate text-sm text-white/90">{b.subtitle}</p>
          ) : null}
        </div>
      </div>
    </div>
  );

  return slug ? (
    <Link href={{ pathname: "/product/[slug]", params: { slug } }}>{inner}</Link>
  ) : (
    inner
  );
}

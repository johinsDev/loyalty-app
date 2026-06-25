"use client";

import { ImageGallery, type RenderGalleryImage } from "@loyalty/ui";
import { Heart } from "lucide-react";
import Image from "next/image";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import imageLoader from "@/lib/image-loader";

import { BLUR } from "../blur";
import { useMenuFavorites } from "../hooks/use-menu-favorites";
import type { ProductDetailData } from "../types";
import { money, num } from "./product-card";

/** Injects next/image (project loader + blur) into the pure ImageGallery. */
const renderGalleryImage: RenderGalleryImage = ({ src, alt, sizes, className, priority }) => (
  <Image
    src={src}
    alt={alt}
    fill
    sizes={sizes}
    placeholder="blur"
    blurDataURL={BLUR}
    priority={priority}
    className={className}
  />
);

/** Shared product detail — rendered both inside the intercepted modal and on the
 *  full `/product/[slug]` page. Selecting option values resolves the matching
 *  variant and swaps price/earn/images. Toppings are display-only (no cart yet). */
export function ProductDetail({ product }: { product: ProductDetailData }) {
  const t = useTranslations("Menu");
  const format = useFormatter();
  const { isFavorite, toggleFavorite } = useMenuFavorites();

  // Selected option value per option; seed from the default variant (or firsts).
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const def = product.variants.find((v) => v.isDefault) ?? product.variants[0];
    const init: Record<string, string> = {};
    for (const opt of product.options) {
      const fromDefault = def?.optionValueIds.find((id) =>
        opt.values.some((v) => v.id === id),
      );
      init[opt.id] = fromDefault ?? opt.values[0]?.id ?? "";
    }
    return init;
  });

  const variant = useMemo(() => {
    const wanted = new Set(Object.values(selected));
    return (
      product.variants.find(
        (v) =>
          v.optionValueIds.length === wanted.size &&
          v.optionValueIds.every((id) => wanted.has(id)),
      ) ?? null
    );
  }, [selected, product.variants]);

  const baseImages = product.images
    .filter((img) => img.variantId === null)
    .map((img) => img.url);
  const images =
    variant && variant.imageUrls.length > 0 ? variant.imageUrls : baseImages;
  const galleryImages = useMemo(
    () =>
      images.map((url) => ({
        src: url,
        alt: product.name,
        // High-res source for the hover zoom (Cloudflare transform in prod).
        zoomSrc: imageLoader({ src: url, width: 1600, quality: 90 }),
      })),
    [images, product.name],
  );
  const priceCents = variant?.priceCents ?? product.basePriceCents;
  const earn = variant?.earn ?? product.earn;
  const fav = isFavorite(product.id);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="relative px-4 pt-2 sm:px-6 sm:pt-5">
        <button
          type="button"
          aria-label={t("favorites")}
          aria-pressed={fav}
          onClick={() => toggleFavorite(product.id)}
          className="bg-card absolute top-4 right-7 z-10 grid size-9 place-items-center rounded-full shadow-md shadow-black/20"
        >
          <Heart
            className={`size-4 ${fav ? "fill-rose-500 text-rose-500" : "text-muted-foreground"}`}
          />
        </button>
        <ImageGallery
          images={galleryImages}
          alt={product.name}
          renderImage={renderGalleryImage}
          emptyFallback={
            <div className="from-primary/15 to-primary/5 grid aspect-square w-full place-items-center rounded-3xl bg-gradient-to-br text-7xl">
              🧋
            </div>
          }
        />
      </div>

      <div className="px-6 pt-5 pb-2 sm:px-8">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {product.name}
          </h1>
          <span className="font-display text-primary text-2xl font-semibold whitespace-nowrap">
            {money(format, priceCents, product.currency)}
          </span>
        </div>

        {product.description ? (
          <div
            className="prose prose-sm dark:prose-invert text-muted-foreground prose-headings:text-foreground prose-a:text-primary mt-2 max-w-none"
            // Admin-authored tiptap HTML — same `prose` styling as the editor.
            dangerouslySetInnerHTML={{ __html: product.description }}
          />
        ) : null}

        <span className="text-primary mt-2 block text-sm font-bold">
          {earn.points > 0 ? t("earnPoints", { points: num(format, earn.points) }) : null}
          {earn.points > 0 && earn.stamp ? " · " : ""}
          {earn.stamp ? t("earnStamp") : null} {t("onRedeem")}
        </span>

        {/* Variant options */}
        {product.options.map((opt) => (
          <div key={opt.id}>
            <p className="mt-5 mb-2 text-sm font-bold">{opt.name}</p>
            <div className="flex flex-wrap gap-2.5">
              {opt.values.map((val) => {
                const active = selected[opt.id] === val.id;
                return (
                  <button
                    key={val.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      setSelected((s) => ({ ...s, [opt.id]: val.id }))
                    }
                    className={`h-12 min-w-24 rounded-2xl border px-4 text-sm font-bold transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-foreground"
                    }`}
                  >
                    {val.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Modifier groups (display-only in v1) */}
        {product.modifierGroups.map((group) => (
          <div key={group.id}>
            <p className="mt-5 mb-2 flex items-center gap-2 text-sm font-bold">
              {group.name}
              {group.required ? (
                <span className="text-muted-foreground text-xs font-semibold">
                  {t("required")}
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-2">
              {group.options.map((mo) => (
                <span
                  key={mo.id}
                  className="border-border text-muted-foreground rounded-full border px-3.5 py-2 text-sm font-semibold"
                >
                  ＋ {mo.name}
                  {mo.priceDeltaCents > 0
                    ? ` ${money(format, mo.priceDeltaCents, product.currency)}`
                    : ""}
                </span>
              ))}
            </div>
          </div>
        ))}

        <div className="pb-[calc(0.5rem+env(safe-area-inset-bottom))]" />
      </div>
    </div>
  );
}

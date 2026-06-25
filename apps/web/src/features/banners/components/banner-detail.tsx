"use client";

import { ArrowRight, ExternalLink } from "lucide-react";
import Image from "next/image";

import type { BannerDetailData } from "../types";
import { CtaLink } from "./cta-link";

/**
 * Shared banner detail — rendered inside the intercepted modal and on the full
 * `/banner/[slug]` page. Two visual layers (background + optional main image),
 * the long (tiptap) description as `prose`, and the CTA button when present
 * (with an open icon, since CTA banners are reached here only by direct URL).
 */
export function BannerDetail({ banner }: { banner: BannerDetailData }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div
        className="relative h-56 w-full shrink-0 lg:h-72"
        style={{ background: banner.backgroundCss ?? "var(--muted)" }}
      >
        {banner.mainImageUrl ? (
          <Image
            src={banner.mainImageUrl}
            alt={banner.name}
            fill
            sizes="(min-width: 1024px) 42rem, 100vw"
            className="object-contain p-4"
            priority
          />
        ) : null}
      </div>

      <div className="px-6 pt-5 pb-8 sm:px-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {banner.name}
        </h1>
        {banner.shortDescription ? (
          <p className="text-muted-foreground mt-1 text-sm">
            {banner.shortDescription}
          </p>
        ) : null}

        {banner.longDescription ? (
          <div
            className="prose prose-sm dark:prose-invert text-muted-foreground prose-headings:text-foreground prose-a:text-primary mt-4 max-w-none"
            // Admin-authored tiptap HTML — same prose styling as the editor.
            dangerouslySetInnerHTML={{ __html: banner.longDescription }}
          />
        ) : null}

        {banner.cta ? (
          <CtaLink
            cta={banner.cta}
            className="bg-primary text-primary-foreground mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-6 text-sm font-bold"
          >
            {banner.cta.label}
            {banner.cta.kind === "external" ? (
              <ExternalLink className="size-4" />
            ) : (
              <ArrowRight className="size-4" />
            )}
          </CtaLink>
        ) : null}

        <div className="pb-[calc(0.5rem+env(safe-area-inset-bottom))]" />
      </div>
    </div>
  );
}

"use client";

import { IconGlyph } from "@loyalty/ui";
import { useTranslations } from "next-intl";

import { type BannerDraft } from "../data";

/**
 * Live in-app banner preview — how the banner renders in the customer PWA home
 * carousel: a gradient hero with emoji, title, subtitle and a CTA pill.
 */
export function BannerPreview({ draft }: { draft: BannerDraft }) {
  const t = useTranslations("Banners");

  return (
    <div className="mx-auto w-full max-w-xs">
      <div
        className="relative overflow-hidden rounded-3xl p-5 text-white shadow-xl"
        style={{ background: draft.bg }}
      >
        <span className="absolute -top-10 -right-6 size-32 rounded-full bg-white/10" />
        <div className="relative">
          <span className="grid size-12 place-items-center overflow-hidden rounded-2xl bg-white/15 text-2xl">
            <IconGlyph value={draft.emoji} />
          </span>
          <div className="font-display mt-3 text-xl leading-tight font-semibold">
            {draft.title || t("previewTitlePlaceholder")}
          </div>
          {draft.subtitle ? (
            <div
              className="prose prose-sm prose-invert mt-1 leading-snug text-white/85"
              dangerouslySetInnerHTML={{ __html: draft.subtitle }}
            />
          ) : null}
          {draft.cta ? (
            <span className="mt-4 inline-flex rounded-full bg-white px-4 py-1.5 text-sm font-bold text-neutral-900">
              {draft.cta}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

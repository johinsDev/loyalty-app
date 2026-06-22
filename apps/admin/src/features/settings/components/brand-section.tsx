"use client";

import { Input, Label } from "@loyalty/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { brand, BRAND_COLORS, BRAND_EMOJIS } from "../data";

/**
 * Brand settings — name, tagline, logo emoji and brand color, with a live
 * card preview. Design-first: state is local; seam is a future
 * `settings.brand` mutation + the storage channel for a real logo upload.
 */
export function BrandSection() {
  const t = useTranslations("Settings");
  const [name, setName] = useState(brand.name);
  const [tagline, setTagline] = useState(brand.tagline);
  const [logoEmoji, setLogoEmoji] = useState(brand.logoEmoji);
  const [color, setColor] = useState(brand.color);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {t("brand.title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("brand.desc")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label={t("brand.name")}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("brand.namePlaceholder")}
              className="h-10"
            />
          </Field>
          <Field label={t("brand.tagline")}>
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder={t("brand.taglinePlaceholder")}
              className="h-10"
            />
          </Field>

          <Field label={t("brand.logo")} hint={t("brand.logoHint")}>
            <div className="flex flex-wrap gap-2">
              {BRAND_EMOJIS.map((emoji) => {
                const on = emoji === logoEmoji;
                return (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setLogoEmoji(emoji)}
                    className={`grid size-12 place-items-center rounded-2xl border text-2xl transition-colors ${
                      on
                        ? "border-primary ring-primary ring-2"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {emoji}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={t("brand.color")}>
            <div className="flex flex-wrap gap-3">
              {BRAND_COLORS.map((c) => {
                const on = c === color;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    aria-label={c}
                    style={{ background: c, color: c }}
                    className={`size-8 rounded-full transition-transform ${
                      on
                        ? "ring-offset-card scale-110 ring-2 ring-current ring-offset-2"
                        : "hover:scale-105"
                    }`}
                  />
                );
              })}
            </div>
          </Field>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t("brand.preview")}</Label>
          <div
            style={{ background: color }}
            className="rounded-3xl p-5 text-white"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-12 flex-none place-items-center rounded-2xl bg-white/15 text-2xl">
                {logoEmoji}
              </span>
              <div className="min-w-0">
                <div className="truncate text-lg font-bold">
                  {name || t("brand.namePlaceholder")}
                </div>
                <div className="truncate text-sm text-white/85">
                  {tagline || t("brand.taglinePlaceholder")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        {hint ? (
          <span className="text-muted-foreground/70 text-xs font-semibold">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

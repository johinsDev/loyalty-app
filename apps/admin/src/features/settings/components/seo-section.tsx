"use client";

import {
  Button,
  Dropzone,
  DropzoneArea,
  DropzoneLabel,
  IconGlyph,
  IconPicker,
  Input,
  Label,
  type Tag,
  TagInput,
  Textarea,
  UrlInput,
} from "@loyalty/ui";
import { Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { seo } from "../data";

/**
 * SEO & favicon settings — meta title/description, keywords, canonical URL,
 * favicon and Open Graph image, with a live preview (browser tab, search
 * result and social card). Design-first: state is local; seam is a future
 * `settings.seo` mutation + the storage channel for the OG image upload.
 */
export function SeoSection() {
  const t = useTranslations("Settings");
  const [metaTitle, setMetaTitle] = useState(seo.metaTitle);
  const [metaDescription, setMetaDescription] = useState(seo.metaDescription);
  const [keywords, setKeywords] = useState<string[]>(seo.keywords);
  const [favicon, setFavicon] = useState(seo.favicon);
  const [ogImage, setOgImage] = useState(seo.ogImage);
  const [canonical, setCanonical] = useState(seo.canonicalUrl);

  const onDropOg = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () =>
      setOgImage(`url("${String(reader.result)}") center/cover no-repeat`),
    );
    reader.readAsDataURL(file);
  };

  const title = metaTitle || t("seo.metaTitlePlaceholder");
  const description = metaDescription || t("seo.metaDescriptionPlaceholder");
  const url = canonical || t("seo.canonicalPlaceholder");
  const host = url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {t("seo.title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("seo.desc")}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label={t("seo.metaTitle")}>
            <Input
              value={metaTitle}
              onChange={(e) => setMetaTitle(e.target.value)}
              placeholder={t("seo.metaTitlePlaceholder")}
              className="h-10"
            />
          </Field>

          <Field label={t("seo.metaDescription")}>
            <Textarea
              value={metaDescription}
              onChange={(e) => setMetaDescription(e.target.value)}
              placeholder={t("seo.metaDescriptionPlaceholder")}
              rows={3}
              className="min-h-20 rounded-xl"
            />
            <span className="text-muted-foreground text-xs">
              {metaDescription.length} / 160
            </span>
          </Field>

          <Field label={t("seo.keywords")}>
            <TagInput
              value={keywords.map((k, i) => ({ id: String(i), text: k }))}
              onChange={(next: Tag[]) => setKeywords(next.map((x) => x.text))}
              placeholder={t("seo.keywordsPlaceholder")}
            />
          </Field>

          <Field label={t("seo.canonical")}>
            <UrlInput
              value={canonical}
              onChange={setCanonical}
              placeholder={t("seo.canonicalPlaceholder")}
            />
          </Field>

          <Field label={t("seo.favicon")} hint={t("seo.faviconHint")}>
            <IconPicker
              value={favicon}
              onValueChange={setFavicon}
              uploadLabel={t("seo.imgUpload")}
              removeLabel={t("seo.imgRemove")}
            />
          </Field>

          <Field label={t("seo.ogImage")} hint={t("seo.ogImageHint")}>
            {ogImage ? (
              <div className="space-y-2">
                <div
                  style={{ background: ogImage }}
                  className="border-border h-32 rounded-2xl border"
                />
                <Button
                  variant="outline"
                  className="h-8"
                  onClick={() => setOgImage("")}
                >
                  {t("seo.imgRemove")}
                </Button>
              </div>
            ) : (
              <Dropzone
                accept={{ "image/*": [] }}
                maxFiles={1}
                multiple={false}
                onDrop={onDropOg}
              >
                <DropzoneArea className="flex-row gap-2 p-4">
                  <Upload className="text-muted-foreground size-4" />
                  <DropzoneLabel className="text-xs">
                    {t("seo.imgUpload")}
                  </DropzoneLabel>
                </DropzoneArea>
              </Dropzone>
            )}
          </Field>
        </div>

        <div className="space-y-4">
          <Label className="text-muted-foreground text-xs uppercase tracking-wide">
            {t("seo.preview")}
          </Label>

          {/* Browser tab */}
          <div className="space-y-1.5">
            <span className="text-muted-foreground/70 text-xs font-semibold">
              {t("seo.tabPreview")}
            </span>
            <div className="bg-muted flex items-center gap-2 rounded-full px-3 py-1.5">
              <span className="grid size-4 flex-none place-items-center overflow-hidden rounded text-xs">
                <IconGlyph value={favicon} />
              </span>
              <span className="truncate text-xs">{title}</span>
            </div>
          </div>

          {/* Search result */}
          <div className="space-y-1.5">
            <span className="text-muted-foreground/70 text-xs font-semibold">
              {t("seo.searchPreview")}
            </span>
            <div className="border-border rounded-2xl border p-4">
              <div className="text-emerald-600 text-xs">{url}</div>
              <div className="truncate text-lg text-blue-600">{title}</div>
              <p className="text-muted-foreground line-clamp-2 text-sm">
                {description}
              </p>
            </div>
          </div>

          {/* Social card (Open Graph) */}
          <div className="space-y-1.5">
            <span className="text-muted-foreground/70 text-xs font-semibold">
              {t("seo.ogImage")}
            </span>
            <div className="border-border overflow-hidden rounded-2xl border">
              {ogImage ? (
                <div
                  style={{ background: ogImage }}
                  className="h-32 rounded-t-2xl"
                />
              ) : (
                <div className="bg-muted h-32 rounded-t-2xl" />
              )}
              <div className="p-3">
                <div className="truncate font-bold">{title}</div>
                <div className="text-muted-foreground truncate text-xs">
                  {host}
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

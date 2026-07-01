"use client";

import { updateSeoInputSchema } from "@loyalty/api/features/settings/schemas";
import { Button, Input, Label, type Tag, TagInput, Textarea } from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { FileUpload } from "@/features/storage/components/file-upload";
import { useTRPC } from "@/lib/trpc/client";

/**
 * SEO settings — meta title/description, keywords and the Open Graph share
 * image (uploaded to R2). Wired to `settings.branding` (read) /
 * `settings.updateSeo` (write); consumed by the apps' root metadata.
 */
export function SeoSection() {
  const t = useTranslations("Settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data } = useQuery(trpc.settings.branding.queryOptions());

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState<Tag[]>([]);
  const [ogImageUrl, setOgImageUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (data && !seeded) {
      setTitle(data.seo.title ?? "");
      setDescription(data.seo.description ?? "");
      setKeywords((data.seo.keywords ?? []).map((text, i) => ({ id: `k${i}`, text })));
      setOgImageUrl(data.seo.ogImageUrl ?? null);
      setFaviconUrl(data.seo.faviconUrl ?? null);
      setSeeded(true);
    }
  }, [data, seeded]);

  const update = useMutation(
    trpc.settings.updateSeo.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.settings.branding.queryFilter());
        toast.success(t("saved"));
      },
      onError: () => toast.error(t("brand.error")),
    }),
  );

  const onSave = () => {
    const payload = {
      seoTitle: title,
      seoDescription: description,
      seoKeywords: keywords.map((k) => k.text.trim()).filter(Boolean),
      ogImageUrl: ogImageUrl ?? "",
      faviconUrl: faviconUrl ?? "",
    };
    // Validate against the shared server schema before saving (no bad data).
    const parsed = updateSeoInputSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("brand.error"));
      return;
    }
    update.mutate(parsed.data);
  };

  return (
    <section className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">{t("seo.title")}</h2>
        <p className="text-muted-foreground mt-1 text-sm">{t("seo.desc")}</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-4">
          <Field label={t("seo.metaTitle")}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("seo.metaTitlePlaceholder")}
              className="h-10"
            />
          </Field>
          <Field label={t("seo.metaDescription")}>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("seo.metaDescriptionPlaceholder")}
              className="min-h-20"
            />
          </Field>
          <Field label={t("seo.keywords")} hint={t("seo.keywordsHint")}>
            <TagInput value={keywords} onChange={setKeywords} placeholder="bubble tea, boba…" />
          </Field>
        </div>

        <div className="space-y-4">
          <Field label={t("seo.ogImage")} hint={t("seo.ogImageHint")}>
            <FileUpload
              value={ogImageUrl ? [ogImageUrl] : []}
              onChange={(urls) => setOgImageUrl(urls[urls.length - 1] ?? null)}
              accept={{ "image/*": [] }}
              multiple={false}
            />
          </Field>

          <Field label={t("seo.favicon")} hint={t("seo.faviconHint")}>
            <FileUpload
              value={faviconUrl ? [faviconUrl] : []}
              onChange={(urls) => setFaviconUrl(urls[urls.length - 1] ?? null)}
              accept={{ "image/png": [".png"], "image/x-icon": [".ico"], "image/svg+xml": [".svg"] }}
              multiple={false}
            />
          </Field>
        </div>
      </div>

      <Button className="h-10 rounded-xl font-semibold" onClick={onSave} disabled={update.isPending}>
        {t("save")}
      </Button>
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
        <Label className="text-sm">{label}</Label>
        {hint ? <span className="text-muted-foreground/70 text-xs font-semibold">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

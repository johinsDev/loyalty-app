"use client";

import { benefitSummary } from "@loyalty/api/features/promotions/format";
import {
  Badge,
  BackgroundPicker,
  Button,
  Input,
  Label,
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalFooter,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
  RichTextEditor,
  Switch,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ChevronLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { FileUpload } from "@/features/storage/components/file-upload";
import { useUploadImage } from "@/features/storage/hooks/use-upload-image";
import { useRouter } from "@/i18n/nav";
import { useTRPC } from "@/lib/trpc/client";

import { PromoStatsBlock } from "./promo-stats-block";
import { PromoPreview } from "./promo-wizard";

type ContentForm = {
  backgroundCss: string;
  mainImageUrl: string | null;
  badgeLabel: string;
  shortDescription: string;
  longDescription: string;
  category: string;
  featured: boolean;
};

/**
 * Published/archived promo screen: mechanics are immutable (archive + recreate
 * to change them); only design/copy stays editable via `patchContent`.
 */
export function PromoPublishedView({ id }: { id: string }) {
  const t = useTranslations("Promotions");
  const locale = useLocale();
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const uploadImage = useUploadImage();

  const promoQuery = useQuery(trpc.promociones.get.queryOptions({ id }));
  const patchMut = useMutation(trpc.promociones.patchContent.mutationOptions());
  const archiveMut = useMutation(trpc.promociones.archive.mutationOptions());

  const [form, setForm] = useState<ContentForm | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const seeded = useRef(false);

  const promo = promoQuery.data;
  useEffect(() => {
    if (!promo || seeded.current) return;
    setForm({
      backgroundCss: promo.backgroundCss ?? "",
      mainImageUrl: promo.mainImageUrl,
      badgeLabel: promo.badgeLabel ?? "",
      shortDescription: promo.shortDescription ?? "",
      longDescription: promo.longDescription ?? "",
      category: promo.category ?? "",
      featured: promo.featured,
    });
    seeded.current = true;
  }, [promo]);

  if (!promo || !form) return null;

  const summary = benefitSummary(promo.type, promo.rule, locale === "en" ? "en" : "es");
  const set = <K extends keyof ContentForm>(key: K, value: ContentForm[K]) =>
    setForm((f) => (f ? { ...f, [key]: value } : f));

  async function save() {
    if (!form) return;
    try {
      await patchMut.mutateAsync({
        id,
        backgroundCss: form.backgroundCss,
        mainImageUrl: form.mainImageUrl ?? "",
        badgeLabel: form.badgeLabel,
        shortDescription: form.shortDescription,
        longDescription: form.longDescription,
        category: form.category,
        featured: form.featured,
      });
      await queryClient.invalidateQueries(trpc.promociones.get.queryFilter({ id }));
      toast.success(t("updated", { name: promo?.name ?? "" }));
    } catch {
      toast.error(t("saveError"));
    }
  }

  async function archive() {
    try {
      await archiveMut.mutateAsync({ id });
      await queryClient.invalidateQueries(trpc.promociones.adminList.queryFilter());
      toast.success(t("archived", { name: promo?.name ?? "" }));
      router.push("/promotions");
    } catch {
      toast.error(t("archiveError"));
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8">
      <button
        type="button"
        onClick={() => router.push("/promotions")}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm font-semibold"
      >
        <ChevronLeft className="size-4" />
        {t("title")}
      </button>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{promo.name}</h1>
          <Badge variant={promo.status === "published" ? "default" : "secondary"}>
            {t(`status.${promo.status}`)}
          </Badge>
        </div>
        {promo.status === "published" ? (
          <Button
            variant="outline"
            className="h-10 gap-1.5 rounded-xl"
            onClick={() => setArchiveOpen(true)}
          >
            <Archive className="size-4" />
            {t("archive")}
          </Button>
        ) : null}
      </div>
      <p className="text-muted-foreground mt-1 text-sm">{t("publishedImmutableHint")}</p>

      <div className="mt-6">
        <PromoStatsBlock id={id} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="bg-card border-border space-y-4 rounded-3xl border p-6 shadow-sm lg:col-span-2">
          <div className="bg-muted/40 rounded-xl px-3 py-2">
            <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
              {t("reviewBenefit")}
            </p>
            <p className="text-sm font-semibold">{summary ?? "—"}</p>
          </div>

          <Field label={t("fieldBg")}>
            <BackgroundPicker
              value={form.backgroundCss}
              onValueChange={(bg) => set("backgroundCss", bg)}
              onUploadImage={uploadImage}
            />
          </Field>
          <Field label={t("fieldMainImage")} hint={t("optional")}>
            <FileUpload
              value={form.mainImageUrl ? [form.mainImageUrl] : []}
              onChange={(urls) => set("mainImageUrl", urls[urls.length - 1] ?? null)}
              accept={{ "image/*": [] }}
              multiple={false}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t("fieldBadge")} hint={t("optional")}>
              <Input
                value={form.badgeLabel}
                onChange={(e) => set("badgeLabel", e.target.value)}
                className="h-10"
              />
            </Field>
            <Field label={t("fieldCategory")} hint={t("optional")}>
              <Input
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="h-10"
              />
            </Field>
          </div>
          <Field label={t("fieldShort")} hint={t("optional")}>
            <Input
              value={form.shortDescription}
              onChange={(e) => set("shortDescription", e.target.value)}
              className="h-10"
            />
          </Field>
          <Field label={t("fieldLong")} hint={t("optional")}>
            <RichTextEditor
              value={form.longDescription}
              onValueChange={(html) => set("longDescription", html)}
            />
          </Field>
          <div className="border-border flex items-center justify-between gap-4 rounded-2xl border p-4">
            <div>
              <p className="text-sm font-semibold">{t("fieldFeatured")}</p>
              <p className="text-muted-foreground text-xs">{t("featuredHint")}</p>
            </div>
            <Switch checked={form.featured} onCheckedChange={(v) => set("featured", v)} />
          </div>

          <div className="flex justify-end">
            <Button
              className="h-10 rounded-xl px-6 font-semibold"
              onClick={save}
              disabled={patchMut.isPending}
            >
              {t("saveChanges")}
            </Button>
          </div>
        </div>

        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <PromoPreview
            name={promo.name ?? ""}
            badge={form.badgeLabel || summary || ""}
            short={form.shortDescription || summary || ""}
            backgroundCss={form.backgroundCss}
            mainImageUrl={form.mainImageUrl}
          />
        </aside>
      </div>

      <ResponsiveModal open={archiveOpen} onOpenChange={setArchiveOpen}>
        <ResponsiveModalContent>
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{t("archiveTitle")}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <p className="text-muted-foreground px-4 pb-2 text-sm">{t("archiveDescription")}</p>
          <ResponsiveModalFooter className="gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full px-5"
              onClick={() => setArchiveOpen(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full px-6 font-semibold"
              onClick={archive}
              disabled={archiveMut.isPending}
            >
              {t("archive")}
            </Button>
          </ResponsiveModalFooter>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
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
        {hint ? <span className="text-muted-foreground/70 text-xs font-semibold">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}

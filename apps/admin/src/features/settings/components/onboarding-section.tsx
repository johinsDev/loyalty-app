"use client";

import {
  type OnboardingAdminStep,
  updateOnboardingInputSchema,
} from "@loyalty/api/features/settings/schemas";
import {
  BackgroundPicker,
  Button,
  IconPicker,
  Input,
  OnboardingSlideView,
  RichTextEditor,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@loyalty/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useUploadImage } from "@/features/storage/hooks/use-upload-image";
import { useTRPC } from "@/lib/trpc/client";

const DEFAULT_BG = "linear-gradient(135deg, #1BAD9D, #0e6f64)";
const SLIDE_EMOJIS = ["🧋", "📱", "🎁", "⭐", "🎉", "💚", "🥤", "🧁"];
const MAX_STEPS = 10;

type Step = OnboardingAdminStep;

const emptyText = (locales: string[]): Step["text"] =>
  Object.fromEntries(locales.map((l) => [l, { title: "", body: "" }]));

const newStep = (locales: string[]): Step => ({
  id: `o${Math.random().toString(36).slice(2)}`,
  icon: SLIDE_EMOJIS[0]!,
  backgroundCss: DEFAULT_BG,
  text: emptyText(locales),
});

/**
 * Onboarding carousel editor for the customer PWA. Wired to
 * `settings.onboardingAdmin` / `settings.updateOnboarding`. Each step has a
 * shared icon + background and per-locale title + rich-text body (locale tabs);
 * 1–10 steps. Live phone preview on the right.
 */
export function OnboardingSection() {
  const t = useTranslations("Settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const uploadImage = useUploadImage();

  const loc = useQuery(trpc.settings.localization.queryOptions());
  const saved = useQuery(trpc.settings.onboardingAdmin.queryOptions());

  const enabledLocales = useMemo(() => loc.data?.enabledLocales ?? ["es"], [loc.data]);
  const defaultLocale = loc.data?.defaultLocale ?? "es";

  const [steps, setSteps] = useState<Step[] | null>(null);
  const [locale, setLocale] = useState(defaultLocale);
  // Which slide the preview shows — steppable so the author walks the real flow.
  const [previewIdx, setPreviewIdx] = useState(0);

  // Seed once, both queries resolved. Backfill any newly-enabled locale so its
  // tab has an entry to edit.
  useEffect(() => {
    if (steps !== null || !saved.data || !loc.data) return;
    const seed = saved.data.length > 0 ? saved.data : [newStep(enabledLocales)];
    setSteps(
      seed.map((s) => ({
        ...s,
        text: { ...emptyText(enabledLocales), ...s.text },
      })),
    );
    setLocale(defaultLocale);
  }, [steps, saved.data, loc.data, enabledLocales, defaultLocale]);

  const save = useMutation(
    trpc.settings.updateOnboarding.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.settings.onboardingAdmin.queryFilter());
        await queryClient.invalidateQueries(trpc.settings.onboarding.queryFilter());
        toast.success(t("saved"));
      },
      onError: (err) => {
        if (err.message.startsWith("ONBOARDING_DEFAULT_TITLE_REQUIRED")) {
          const n = Number(err.message.split(":")[1] ?? 0) + 1;
          toast.error(t("onboarding.errDefaultTitle", { n, locale: defaultLocale.toUpperCase() }));
        } else {
          toast.error(t("onboarding.error"));
        }
      },
    }),
  );

  if (steps === null) {
    return <Skeleton className="h-96 w-full rounded-2xl" />;
  }

  const patch = (id: string, p: Partial<Step>) =>
    setSteps((prev) => prev!.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const patchText = (id: string, field: "title" | "body", value: string) =>
    setSteps((prev) =>
      prev!.map((s) => {
        if (s.id !== id) return s;
        const entry = s.text[locale] ?? { title: "", body: "" };
        return { ...s, text: { ...s.text, [locale]: { ...entry, [field]: value } } };
      }),
    );
  const remove = (id: string) => setSteps((prev) => prev!.filter((s) => s.id !== id));
  const add = () => setSteps((prev) => [...prev!, newStep(enabledLocales)]);

  const onSave = () => {
    const parsed = updateOnboardingInputSchema.safeParse({ steps });
    if (!parsed.success) {
      toast.error(t("onboarding.invalid"));
      return;
    }
    save.mutate(parsed.data);
  };

  const previewSlide = steps[Math.min(previewIdx, steps.length - 1)] ?? steps[0]!;
  const previewText = previewSlide.text[locale] ?? { title: "", body: "" };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {t("onboarding.title")}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">{t("onboarding.desc")}</p>
        </div>
        {enabledLocales.length > 1 ? (
          <Tabs value={locale} onValueChange={setLocale}>
            <TabsList className="h-9">
              {enabledLocales.map((l) => (
                <TabsTrigger key={l} value={l} className="px-3 uppercase">
                  {l}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {steps.map((step, idx) => (
            <div key={step.id} className="border-border space-y-2 rounded-2xl border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">
                  {t("onboarding.slideN", { n: idx + 1 })}
                </span>
                <button
                  type="button"
                  onClick={() => remove(step.id)}
                  disabled={steps.length <= 1}
                  aria-label={t("onboarding.remove")}
                  className="text-muted-foreground hover:text-destructive grid size-8 place-items-center rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-40"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <IconPicker
                value={step.icon}
                onValueChange={(icon) => patch(step.id, { icon })}
                onUploadImage={uploadImage}
                emojis={SLIDE_EMOJIS}
                customLabel={t("onboarding.iconCustom")}
                uploadLabel={t("onboarding.imgUpload")}
                removeLabel={t("onboarding.imgRemove")}
              />
              <Input
                value={step.text[locale]?.title ?? ""}
                onChange={(e) => patchText(step.id, "title", e.target.value)}
                placeholder={t("onboarding.titlePlaceholder")}
                className="h-10"
              />
              <RichTextEditor
                key={`${step.id}-${locale}`}
                value={step.text[locale]?.body ?? ""}
                onValueChange={(body) => patchText(step.id, "body", body)}
                onUploadImage={uploadImage}
              />
              <div className="space-y-1.5">
                <span className="text-muted-foreground/70 text-xs font-semibold">
                  {t("onboarding.bg")}
                </span>
                <BackgroundPicker
                  value={step.backgroundCss}
                  onValueChange={(backgroundCss) => patch(step.id, { backgroundCss })}
                  onUploadImage={uploadImage}
                  colorLabel={t("onboarding.customColor")}
                  uploadLabel={t("onboarding.imgUpload")}
                  removeLabel={t("onboarding.imgRemove")}
                />
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            onClick={add}
            disabled={steps.length >= MAX_STEPS}
            className="w-full"
          >
            + {t("onboarding.addSlide")}
          </Button>
          {steps.length >= MAX_STEPS ? (
            <p className="text-muted-foreground text-center text-xs">
              {t("onboarding.maxReached", { n: MAX_STEPS })}
            </p>
          ) : null}
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <p className="text-muted-foreground/70 text-xs font-semibold tracking-wide uppercase">
            {t("onboarding.previewTitle")}
          </p>
          <div
            style={{ background: previewSlide.backgroundCss || DEFAULT_BG }}
            className="border-border mx-auto w-56 rounded-3xl border-8 p-5 text-white"
          >
            <div className="flex min-h-72 flex-col">
              <div className="flex flex-1 flex-col items-center justify-center gap-3">
                <OnboardingSlideView
                  size="sm"
                  onDark
                  icon={previewSlide.icon || "🧋"}
                  title={previewText.title || t("onboarding.titlePlaceholder")}
                  body={previewText.body || null}
                />
                {steps.length > 1 ? (
                  <div className="flex items-center gap-1.5">
                    {steps.map((s, i) => (
                      <button
                        key={s.id}
                        type="button"
                        aria-label={`${i + 1}`}
                        onClick={() => setPreviewIdx(i)}
                        className={`h-1.5 rounded-full transition-all ${
                          i === previewIdx ? "w-4 bg-white" : "w-1.5 bg-white/40"
                        }`}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white/80 hover:bg-white/10 hover:text-white"
                  onClick={() => setPreviewIdx(steps.length - 1)}
                >
                  {t("onboarding.skip")}
                </Button>
                <Button size="sm" onClick={() => setPreviewIdx((i) => (i + 1) % steps.length)}>
                  {previewIdx >= steps.length - 1 ? t("onboarding.start") : t("onboarding.next")}
                </Button>
              </div>
            </div>
          </div>
          <Button
            onClick={onSave}
            disabled={save.isPending}
            className="h-10 w-full rounded-xl font-semibold"
          >
            {t("save")}
          </Button>
        </div>
      </div>
    </section>
  );
}

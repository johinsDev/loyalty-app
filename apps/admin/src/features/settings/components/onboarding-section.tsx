"use client";

import {
  BackgroundPicker,
  Button,
  IconPicker,
  Input,
  RichTextEditor,
} from "@loyalty/ui";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { type OnboardingSlide, onboardingSlides, SLIDE_EMOJIS } from "../data";

const DEFAULT_SLIDE_BG = "linear-gradient(135deg, #1BAD9D, #0e6f64)";

// Slides carry a per-slide background color and an HTML body (the body is now
// edited through the rich-text editor), so we extend the seed shape locally.
type EditableSlide = OnboardingSlide & { bg: string };

/**
 * Onboarding slides editor with a live phone preview. Design-first: state is
 * local, seeded from the hardcoded `onboardingSlides`. Seam: a future
 * `settings.onboarding` mutation backing the customer PWA's first-run carousel.
 */
export function OnboardingSection() {
  const t = useTranslations("Settings");
  const [slides, setSlides] = useState<EditableSlide[]>(() =>
    onboardingSlides.map((slide) => ({
      ...slide,
      bg: DEFAULT_SLIDE_BG,
      body: `<p>${slide.body}</p>`,
    })),
  );

  const update = (id: string, patch: Partial<EditableSlide>) =>
    setSlides((prev) =>
      prev.map((slide) => (slide.id === id ? { ...slide, ...patch } : slide)),
    );
  const remove = (id: string) =>
    setSlides((prev) => prev.filter((slide) => slide.id !== id));
  const add = () =>
    setSlides((prev) => [
      ...prev,
      {
        id: `o${Math.random().toString(36).slice(2)}`,
        emoji: SLIDE_EMOJIS[0]!,
        title: "",
        body: "",
        bg: DEFAULT_SLIDE_BG,
      },
    ]);

  const first = slides[0];

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {t("onboarding.title")}
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          {t("onboarding.desc")}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {slides.map((slide, idx) => (
            <div
              key={slide.id}
              className="border-border space-y-2 rounded-2xl border p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold">
                  {t("onboarding.slideN", { n: idx + 1 })}
                </span>
                <button
                  type="button"
                  onClick={() => remove(slide.id)}
                  aria-label={t("onboarding.remove")}
                  className="text-muted-foreground hover:text-destructive grid size-8 place-items-center rounded-lg transition-colors"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              <IconPicker
                value={slide.emoji}
                onValueChange={(emoji) => update(slide.id, { emoji })}
                emojis={SLIDE_EMOJIS}
                customLabel={t("onboarding.iconCustom")}
              />
              <Input
                value={slide.title}
                onChange={(e) => update(slide.id, { title: e.target.value })}
                placeholder={t("onboarding.titlePlaceholder")}
                className="h-10"
              />
              <RichTextEditor
                value={slide.body}
                onValueChange={(body) => update(slide.id, { body })}
              />
              <div className="space-y-1.5">
                <span className="text-muted-foreground/70 text-xs font-semibold">
                  {t("onboarding.bg")}
                </span>
                <BackgroundPicker
                  value={slide.bg}
                  onValueChange={(bg) => update(slide.id, { bg })}
                  customLabel={t("onboarding.customColor")}
                />
              </div>
            </div>
          ))}
          <Button variant="outline" onClick={add} className="w-full">
            + {t("onboarding.addSlide")}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-muted-foreground/70 text-xs font-semibold tracking-wide uppercase">
            {t("onboarding.previewTitle")}
          </p>
          <div
            style={{ background: first?.bg ?? DEFAULT_SLIDE_BG }}
            className="border-border mx-auto w-56 rounded-3xl border-8 p-5 text-white"
          >
            <div className="flex min-h-72 flex-col">
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <span className="text-5xl">{first?.emoji ?? "🧋"}</span>
                <h3 className="font-display mt-4 font-semibold">
                  {first?.title || t("onboarding.titlePlaceholder")}
                </h3>
                <div
                  className="prose prose-sm prose-invert mt-2"
                  // Body is authored as HTML via the rich-text editor.
                  dangerouslySetInnerHTML={{ __html: first?.body ?? "" }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Button variant="ghost" size="sm">
                  {t("onboarding.skip")}
                </Button>
                <Button size="sm">{t("onboarding.next")}</Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

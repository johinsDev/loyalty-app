"use client";

import { Button, Input, Textarea } from "@loyalty/ui";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { type OnboardingSlide, onboardingSlides, SLIDE_EMOJIS } from "../data";

/**
 * Onboarding slides editor with a live phone preview. Design-first: state is
 * local, seeded from the hardcoded `onboardingSlides`. Seam: a future
 * `settings.onboarding` mutation backing the customer PWA's first-run carousel.
 */
export function OnboardingSection() {
  const t = useTranslations("Settings");
  const [slides, setSlides] = useState<OnboardingSlide[]>(onboardingSlides);

  const update = (id: string, patch: Partial<OnboardingSlide>) =>
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
              <div className="flex flex-wrap gap-1.5">
                {SLIDE_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => update(slide.id, { emoji })}
                    className={`grid size-9 place-items-center rounded-xl text-lg transition-colors ${
                      slide.emoji === emoji
                        ? "ring-primary ring-2"
                        : "bg-muted hover:bg-muted/70"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <Input
                value={slide.title}
                onChange={(e) => update(slide.id, { title: e.target.value })}
                placeholder={t("onboarding.titlePlaceholder")}
                className="h-10"
              />
              <Textarea
                value={slide.body}
                onChange={(e) => update(slide.id, { body: e.target.value })}
                placeholder={t("onboarding.bodyPlaceholder")}
                rows={3}
                className="rounded-xl"
              />
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
          <div className="border-border bg-card mx-auto w-56 rounded-3xl border-8 p-5">
            <div className="flex min-h-72 flex-col">
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <span className="text-5xl">{first?.emoji ?? "🧋"}</span>
                <h3 className="font-display mt-4 font-semibold">
                  {first?.title || t("onboarding.titlePlaceholder")}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {first?.body || t("onboarding.bodyPlaceholder")}
                </p>
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

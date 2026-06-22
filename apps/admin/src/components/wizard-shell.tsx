"use client";

import { Button, Stepper, type StepperStep } from "@loyalty/ui";
import { Check, ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/**
 * Shared create/edit wizard chrome for the catalog CRUDs (products, rewards):
 * a Stepper, a "borrador guardado" indicator, the current step content on the
 * left and a sticky live preview on the right (stacks on mobile), and a
 * Back/Next footer. Design-first — step state lives in the caller; the
 * server-driven draft (see the `wizard` skill / PromoWizard) is the seam.
 */
export function WizardShell({
  title,
  steps,
  current,
  completed,
  onStepSelect,
  onBack,
  onNext,
  isFirst,
  isLast,
  finishLabel,
  preview,
  children,
}: {
  title: string;
  steps: StepperStep[];
  current: string;
  completed: string[];
  onStepSelect?: (key: string) => void;
  onBack: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
  finishLabel: string;
  preview: ReactNode;
  children: ReactNode;
}) {
  const t = useTranslations("Wizard");

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {title}
        </h1>
        <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-bold">
          <Check className="size-3.5 text-emerald-600" />
          {t("draftSaved")}
        </span>
      </div>

      <div className="mt-5">
        <Stepper
          steps={steps}
          current={current}
          completed={completed}
          onSelect={onStepSelect}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="bg-card border-border flex flex-col rounded-3xl border p-6 shadow-sm lg:col-span-2">
          <div className="flex-1">{children}</div>
          <div className="border-border mt-6 flex items-center justify-between border-t pt-4">
            <Button
              variant="outline"
              className="h-10 gap-1.5 rounded-xl"
              onClick={onBack}
              disabled={isFirst}
            >
              <ChevronLeft className="size-4" />
              {t("back")}
            </Button>
            <Button
              className="h-10 rounded-xl px-6 font-semibold"
              onClick={onNext}
            >
              {isLast ? finishLabel : t("next")}
            </Button>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:col-span-1 lg:self-start">
          <div className="text-muted-foreground/70 mb-2 px-1 text-xs font-extrabold tracking-wider uppercase">
            {t("preview")}
          </div>
          {preview}
        </aside>
      </div>
    </div>
  );
}

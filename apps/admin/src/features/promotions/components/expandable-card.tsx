"use client";

import {
  ResponsiveModal,
  ResponsiveModalContent,
  ResponsiveModalHeader,
  ResponsiveModalTitle,
} from "@loyalty/ui";
import { Maximize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/**
 * A stats card with an expand affordance: renders a compact body inline and the
 * same content larger inside a modal. `render(expanded)` lets the caller size
 * its chart/table per variant (e.g. a taller chart when expanded).
 */
export function ExpandableCard({
  title,
  subtitle,
  render,
}: {
  title: string;
  subtitle?: string;
  render: (expanded: boolean) => React.ReactNode;
}) {
  const t = useTranslations("Promotions.analytics");
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-card rounded-3xl border p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="text-muted-foreground text-xs font-semibold">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("expand")}
          className="text-muted-foreground hover:bg-muted hover:text-foreground -mr-1 -mt-1 flex size-8 flex-none items-center justify-center rounded-lg transition-colors"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>

      {render(false)}

      <ResponsiveModal open={open} onOpenChange={setOpen}>
        <ResponsiveModalContent className="max-w-4xl">
          <ResponsiveModalHeader>
            <ResponsiveModalTitle>{title}</ResponsiveModalTitle>
          </ResponsiveModalHeader>
          <div className="px-4 pb-6 pt-2">{render(true)}</div>
        </ResponsiveModalContent>
      </ResponsiveModal>
    </div>
  );
}

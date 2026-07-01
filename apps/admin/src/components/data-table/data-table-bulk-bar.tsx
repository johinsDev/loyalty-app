"use client";

import { Button } from "@loyalty/ui";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

/** Floating action bar shown while rows are selected. Actions are passed by the
 *  consuming list (export / delete / model-specific). */
export function DataTableBulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("DataTable");
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
      <div className="bg-card border-border pointer-events-auto flex items-center gap-2 rounded-full border p-1.5 pl-3 shadow-lg">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
          {t("selectedCount", { n: count })}
          <Button
            variant="ghost"
            size="icon"
            className="size-6 rounded-full"
            aria-label={t("clearSelection")}
            onClick={onClear}
          >
            <X className="size-3.5" />
          </Button>
        </span>
        <span className="bg-border mx-0.5 h-5 w-px" />
        {children}
      </div>
    </div>
  );
}

"use client";

import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@loyalty/ui";
import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

/**
 * Filters drawer (right-side Sheet) for the data-table: a single "Filtros"
 * trigger with an active-count badge, a scrollable body where the feature
 * stacks its facet sections, and a Clear-all / Done footer. Keeps the toolbar
 * uncluttered — only search + this + Sort/View/grid-list remain inline.
 */
export function DataTableFilters({
  activeCount,
  onClear,
  children,
}: {
  activeCount: number;
  onClear: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("DataTable");
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="outline" size="sm" className="h-10 gap-1.5 rounded-xl">
            <SlidersHorizontal className="size-4" />
            {t("filters")}
            {activeCount > 0 ? (
              <Badge variant="secondary" className="ml-0.5 px-1.5">
                {activeCount}
              </Badge>
            ) : null}
          </Button>
        }
      />
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b">
          <SheetTitle>{t("filters")}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-6 overflow-y-auto p-5">{children}</div>
        <SheetFooter className="border-border flex-row items-center justify-between border-t">
          <Button
            variant="ghost"
            className="h-10 rounded-xl"
            onClick={onClear}
            disabled={activeCount === 0}
          >
            {t("clearAll")}
          </Button>
          <Button className="h-10 rounded-xl px-6 font-semibold" onClick={() => setOpen(false)}>
            {t("done")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** A labeled section inside the filters drawer. */
export function FilterSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <p className="text-sm font-semibold">{label}</p>
      {children}
    </div>
  );
}

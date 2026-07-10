"use client";

import { Button } from "@loyalty/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";

import type { CursorPages } from "../hooks/use-cursor-pages";

/** Prev/Next footer for the cursor-paginated lists in the customer 360. There
 *  is no total count (the ledgers are cursor-based), so we show the page number
 *  rather than "page X of Y". */
export function CursorPager<T>({ pages }: { pages: CursorPages<T> }) {
  const t = useTranslations("Customers");
  if (!pages.hasPrev && !pages.hasNext) return null;

  return (
    <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
      <span className="text-muted-foreground text-xs font-semibold">
        {t("pager.page", { n: pages.pageNumber })}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1 rounded-xl"
          disabled={!pages.hasPrev}
          onClick={pages.prev}
        >
          <ChevronLeft className="size-4" />
          {t("prev")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1 rounded-xl"
          disabled={!pages.hasNext || pages.isLoadingNext}
          onClick={pages.next}
        >
          {t("next")}
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

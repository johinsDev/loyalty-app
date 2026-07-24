"use client";

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";

import { useSelection } from "./data-table-selection";
import { PER_PAGE_OPTIONS, tableParsers } from "./parsers";

const SHALLOW = { shallow: false } as const;

/**
 * Pagination for the server table. `page`/`perPage` write to the URL with
 * `shallow:false` so each change re-runs the server render of the table hole.
 * `pageCount`/`total` come from the server query (props); the selected count is
 * read from the client {@link useSelection} context.
 */
export function ServerPagination({ pageCount, total }: { pageCount: number; total: number }) {
  const t = useTranslations("DataTable");
  const { ids } = useSelection();
  const [page, setPage] = useQueryState("page", tableParsers.page.withOptions(SHALLOW));
  const [perPage, setPerPage] = useQueryState("perPage", tableParsers.perPage.withOptions(SHALLOW));
  const pages = Math.max(1, pageCount);
  const goto = (p: number) => void setPage(Math.min(Math.max(1, p), pages));

  return (
    <div className="text-muted-foreground flex flex-col-reverse items-center gap-4 px-2 py-3 text-sm sm:flex-row sm:justify-between">
      <span>{t("selected", { n: ids.size, total })}</span>
      <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{t("rowsPerPage")}</span>
          <Select
            value={String(perPage)}
            onValueChange={(v) => {
              void setPerPage(Number(v ?? perPage));
              void setPage(1);
            }}
          >
            <SelectTrigger size="sm" className="h-9 w-[4.5rem]">
              <SelectValue>{(v) => (v as string) || String(perPage)}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PER_PAGE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="font-medium">{t("pageOf", { page, pages })}</span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-xl"
            aria-label={t("first")}
            onClick={() => goto(1)}
            disabled={page <= 1}
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-xl"
            aria-label={t("prev")}
            onClick={() => goto(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-xl"
            aria-label={t("next")}
            onClick={() => goto(page + 1)}
            disabled={page >= pages}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-xl"
            aria-label={t("last")}
            onClick={() => goto(pages)}
            disabled={page >= pages}
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

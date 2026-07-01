"use client";

import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { PER_PAGE_OPTIONS } from "./parsers";

export function DataTablePagination<T>({
  table,
  total,
  selectedCount,
}: {
  table: Table<T>;
  total: number;
  selectedCount: number;
}) {
  const t = useTranslations("DataTable");
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const current = pageIndex + 1;

  return (
    <div className="text-muted-foreground flex flex-col-reverse items-center gap-4 px-2 py-3 text-sm sm:flex-row sm:justify-between">
      <span>{t("selected", { n: selectedCount, total })}</span>
      <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-3">
        <div className="flex items-center gap-2">
          <span className="font-medium">{t("rowsPerPage")}</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => table.setPageSize(Number(v ?? pageSize))}
          >
            <SelectTrigger size="sm" className="h-9 w-[4.5rem]">
              <SelectValue>{(v) => (v as string) || String(pageSize)}</SelectValue>
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
        <span className="font-medium">{t("pageOf", { page: current, pages: pageCount })}</span>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-xl"
            aria-label={t("first")}
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-xl"
            aria-label={t("prev")}
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-xl"
            aria-label={t("next")}
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-9 rounded-xl"
            aria-label={t("last")}
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

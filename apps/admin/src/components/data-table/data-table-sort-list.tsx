"use client";

import {
  Badge,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@loyalty/ui";
import type { Table } from "@tanstack/react-table";
import { ArrowDownUp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

/** Multi-column sort panel (Sort by · Add sort · Reset) — writes the `sort`
 *  URL param via the table's sorting state. */
export function DataTableSortList<T>({ table }: { table: Table<T> }) {
  const t = useTranslations("DataTable");
  const sorting = table.getState().sorting;
  const sortable = table.getAllColumns().filter((c) => c.getCanSort());
  const labelOf = (id: string) =>
    (table.getColumn(id)?.columnDef.meta as { label?: string } | undefined)?.label ?? id;

  const used = new Set(sorting.map((s) => s.id));
  const firstFree = sortable.find((c) => !used.has(c.id));

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="h-10 gap-1.5 rounded-xl">
            <ArrowDownUp className="size-4" />
            <span className="hidden sm:inline">{t("sort")}</span>
            {sorting.length > 0 ? (
              <Badge variant="secondary" className="ml-0.5 px-1.5">
                {sorting.length}
              </Badge>
            ) : null}
          </Button>
        }
      />
      <PopoverContent align="end" className="w-[22rem] space-y-3">
        <p className="text-sm font-semibold">{t("sortBy")}</p>
        {sorting.length === 0 ? (
          <p className="text-muted-foreground text-xs">{t("noSort")}</p>
        ) : (
          <div className="space-y-2">
            {sorting.map((rule, i) => (
              <div key={rule.id} className="flex items-center gap-2">
                <Select
                  value={rule.id}
                  onValueChange={(v) => {
                    if (!v) return;
                    table.setSorting(sorting.map((s, j) => (j === i ? { ...s, id: v } : s)));
                  }}
                >
                  <SelectTrigger size="sm" className="h-9 flex-1">
                    <SelectValue>{(v) => labelOf(v as string)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {sortable
                      .filter((c) => c.id === rule.id || !used.has(c.id))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {labelOf(c.id)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select
                  value={rule.desc ? "desc" : "asc"}
                  onValueChange={(v) =>
                    table.setSorting(
                      sorting.map((s, j) => (j === i ? { ...s, desc: v === "desc" } : s)),
                    )
                  }
                >
                  <SelectTrigger size="sm" className="h-9 w-[6.5rem]">
                    <SelectValue>{(v) => t(`dir.${v as string}`)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">{t("dir.asc")}</SelectItem>
                    <SelectItem value="desc">{t("dir.desc")}</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-9 shrink-0 rounded-xl"
                  aria-label={t("removeSort")}
                  onClick={() => table.setSorting(sorting.filter((_, j) => j !== i))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 rounded-xl"
            disabled={!firstFree}
            onClick={() =>
              firstFree && table.setSorting([...sorting, { id: firstFree.id, desc: false }])
            }
          >
            {t("addSort")}
          </Button>
          {sorting.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-xl"
              onClick={() => table.setSorting([])}
            >
              {t("resetSort")}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
import { ArrowDownUp, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQueryState } from "nuqs";

import { tableParsers } from "./parsers";

const SHALLOW = { shallow: false } as const;

export type SortableColumn = { id: string; label: string };

/**
 * Multi-column sort panel for the server table (Sort by · Add sort · Reset).
 * Reads/writes the `sort` URL param via nuqs (`shallow:false` → server
 * re-render), driven by a plain column descriptor list — no tanstack instance.
 */
export function ServerSortList({ columns }: { columns: SortableColumn[] }) {
  const t = useTranslations("DataTable");
  const [sorting, setSorting] = useQueryState("sort", tableParsers.sort.withOptions(SHALLOW));
  const [, setPage] = useQueryState("page", tableParsers.page.withOptions(SHALLOW));
  const labelOf = (id: string) => columns.find((c) => c.id === id)?.label ?? id;

  const used = new Set(sorting.map((s) => s.id));
  const firstFree = columns.find((c) => !used.has(c.id));
  const commit = (next: { id: string; desc: boolean }[]) => {
    void setSorting(next.length ? next : null);
    void setPage(1);
  };

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
                    commit(sorting.map((s, j) => (j === i ? { ...s, id: v } : s)));
                  }}
                >
                  <SelectTrigger size="sm" className="h-9 flex-1">
                    <SelectValue>{(v) => labelOf(v as string)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {columns
                      .filter((c) => c.id === rule.id || !used.has(c.id))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Select
                  value={rule.desc ? "desc" : "asc"}
                  onValueChange={(v) =>
                    commit(sorting.map((s, j) => (j === i ? { ...s, desc: v === "desc" } : s)))
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
                  onClick={() => commit(sorting.filter((_, j) => j !== i))}
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
            onClick={() => firstFree && commit([...sorting, { id: firstFree.id, desc: false }])}
          >
            {t("addSort")}
          </Button>
          {sorting.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 rounded-xl"
              onClick={() => commit([])}
            >
              {t("resetSort")}
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

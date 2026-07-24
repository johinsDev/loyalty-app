"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useQueryState } from "nuqs";

import { tableParsers } from "./parsers";

const SHALLOW = { shallow: false } as const;

/**
 * Clickable column header for the server table — cycles that column's sort
 * (none → asc → desc → none) as a single-column sort in the URL (`shallow:false`
 * → server re-render). The multi-column panel is {@link ServerSortList}.
 */
export function ServerSortHeader({
  columnId,
  title,
  align,
}: {
  columnId: string;
  title: string;
  align?: "left" | "right";
}) {
  const [sort, setSort] = useQueryState("sort", tableParsers.sort.withOptions(SHALLOW));
  const [, setPage] = useQueryState("page", tableParsers.page.withOptions(SHALLOW));
  const current = sort.find((s) => s.id === columnId);

  const onClick = () => {
    const next = !current
      ? [{ id: columnId, desc: false }]
      : !current.desc
        ? [{ id: columnId, desc: true }]
        : [];
    void setSort(next.length ? next : null);
    void setPage(1);
  };

  const Icon = !current ? ChevronsUpDown : current.desc ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-muted-foreground hover:text-foreground inline-flex w-full items-center gap-1 text-xs font-bold ${
        align === "right" ? "justify-end" : ""
      }`}
    >
      {title}
      <Icon className={`size-3.5 ${current ? "text-foreground" : "opacity-50"}`} />
    </button>
  );
}

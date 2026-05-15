"use client";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@loyalty/ui";
import { parseAsInteger, useQueryState } from "nuqs";

const MAX_VISIBLE = 5;

type Props = { total: number; pageSize: number };

export function PaginationControls({ total, pageSize }: Props) {
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), totalPages);
  const visible = computeVisible(current, totalPages, MAX_VISIBLE);

  const go = (p: number) => {
    if (p < 1 || p > totalPages) return;
    void setPage(p === 1 ? null : p);
  };

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={(e) => {
              e.preventDefault();
              go(current - 1);
            }}
            href="#"
            aria-disabled={current === 1}
          />
        </PaginationItem>
        {visible.map((p, i) =>
          p === null ? (
            <PaginationItem key={`ellipsis-${i}`}>
              <PaginationEllipsis />
            </PaginationItem>
          ) : (
            <PaginationItem key={p}>
              <PaginationLink
                href="#"
                isActive={p === current}
                onClick={(e) => {
                  e.preventDefault();
                  go(p);
                }}
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        <PaginationItem>
          <PaginationNext
            onClick={(e) => {
              e.preventDefault();
              go(current + 1);
            }}
            href="#"
            aria-disabled={current === totalPages}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

function computeVisible(
  current: number,
  total: number,
  maxVisible: number,
): (number | null)[] {
  if (total <= maxVisible) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const half = Math.floor(maxVisible / 2);
  let start = Math.max(2, current - half);
  let end = Math.min(total - 1, current + half);
  if (current - 1 <= half) end = maxVisible - 1;
  if (total - current <= half) start = total - maxVisible + 2;

  const items: (number | null)[] = [1];
  if (start > 2) items.push(null);
  for (let p = start; p <= end; p++) items.push(p);
  if (end < total - 1) items.push(null);
  items.push(total);
  return items;
}

"use client";

import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import { flexRender, type Table as TanstackTable } from "@tanstack/react-table";
import type { ReactNode } from "react";

import type { ViewMode } from "./parsers";

/**
 * Presentational data-table: renders the `@tanstack/react-table` instance built
 * by `useDataTable`. Shows skeleton rows while fetching, an empty state when
 * there are no rows, and delegates the grid view to `renderGrid`.
 */
export function DataTable<T>({
  table,
  view = "list",
  isFetching = false,
  emptyState,
  renderGrid,
  onRowClick,
}: {
  table: TanstackTable<T>;
  view?: ViewMode;
  isFetching?: boolean;
  emptyState: ReactNode;
  renderGrid?: (rows: T[]) => ReactNode;
  /** Whole-row navigation; interactive cells must stopPropagation. */
  onRowClick?: (row: T) => void;
}) {
  const rows = table.getRowModel().rows;
  const colCount = table.getVisibleLeafColumns().length;
  const showEmpty = !isFetching && rows.length === 0;

  if (view === "grid" && renderGrid) {
    if (showEmpty) return <>{emptyState}</>;
    if (isFetching && rows.length === 0) {
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {["a", "b", "c", "d", "e", "f"].map((k) => (
            <Skeleton key={k} className="h-28 rounded-3xl" />
          ))}
        </div>
      );
    }
    return <>{renderGrid(rows.map((r) => r.original))}</>;
  }

  return (
    <div className="bg-card border-border overflow-x-auto rounded-3xl border shadow-sm">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id} style={{ width: header.getSize() }}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isFetching && rows.length === 0 ? (
            Array.from({ length: 8 }, (_, i) => (
              <TableRow key={`sk-${i}`}>
                {Array.from({ length: colCount }, (_, c) => (
                  <TableCell key={c}>
                    <Skeleton className="h-5 w-full max-w-[140px]" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : showEmpty ? (
            <TableRow>
              <TableCell colSpan={colCount} className="h-40 p-0">
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
                className={onRowClick ? "cursor-pointer" : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

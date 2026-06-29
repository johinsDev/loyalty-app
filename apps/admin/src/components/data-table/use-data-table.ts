"use client";

import {
  type ColumnDef,
  getCoreRowModel,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type Table,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { useQueryState } from "nuqs";
import { useMemo, useState } from "react";

import { tableParsers } from "./parsers";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends import("@tanstack/react-table").RowData, TValue> {
    /** Human label for the View menu + Sort list. */
    label?: string;
  }
}

/**
 * Wires `@tanstack/react-table` to the URL (nuqs) for the standard admin
 * data-table: pagination + multi-sort + column visibility live in the URL
 * (shareable); row selection is local (a Record keyed by row id, so it persists
 * across pages). Server-driven — manual pagination/sorting/filtering. The query
 * itself is fetched by the caller (reading the same nuqs params); this hook just
 * builds the `table` instance + selection helpers. See the `data-table` skill.
 */
export function useDataTable<T>(opts: {
  data: T[];
  columns: ColumnDef<T, unknown>[];
  pageCount: number;
  getRowId: (row: T) => string;
}): { table: Table<T>; selectedIds: string[]; resetSelection: () => void } {
  const { data, columns, pageCount, getRowId } = opts;
  const [page, setPage] = useQueryState("page", tableParsers.page);
  const [perPage, setPerPage] = useQueryState("perPage", tableParsers.perPage);
  const [sort, setSort] = useQueryState("sort", tableParsers.sort);
  const [hidden, setHidden] = useQueryState("cols", tableParsers.cols);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const sorting: SortingState = useMemo(() => sort.map((s) => ({ id: s.id, desc: s.desc })), [sort]);
  const pagination: PaginationState = useMemo(
    () => ({ pageIndex: page - 1, pageSize: perPage }),
    [page, perPage],
  );
  const columnVisibility: VisibilityState = useMemo(
    () => Object.fromEntries(hidden.map((id) => [id, false])),
    [hidden],
  );

  const table = useReactTable<T>({
    data,
    columns,
    pageCount,
    getRowId,
    state: { sorting, pagination, columnVisibility, rowSelection },
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      void setSort(next.map((s) => ({ id: s.id, desc: s.desc })));
      void setPage(1);
    },
    onPaginationChange: (updater) => {
      const next = typeof updater === "function" ? updater(pagination) : updater;
      void setPage(next.pageIndex + 1);
      void setPerPage(next.pageSize);
    },
    onColumnVisibilityChange: (updater) => {
      const next = typeof updater === "function" ? updater(columnVisibility) : updater;
      void setHidden(Object.keys(next).filter((id) => next[id] === false));
    },
  });

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  return { table, selectedIds, resetSelection: () => setRowSelection({}) };
}

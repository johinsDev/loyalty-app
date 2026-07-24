import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";
import type { ReactNode } from "react";

/**
 * A column descriptor for {@link ServerTable} — the tanstack-free counterpart of
 * a `ColumnDef`. Cells render as plain JSX (server-rendered), embedding client
 * islands where a cell is interactive (a row checkbox, a link). Sort/visibility
 * live in the URL, so the toolbar islands ({@link ServerSortList},
 * {@link ServerViewOptions}) drive off this same descriptor list.
 */
export type ServerColumn<T> = {
  id: string;
  /** Human label for the sort/view menus + the default header. */
  label?: string;
  sortable?: boolean;
  /** Toggle-able in the View menu. Default `true` (select/action columns pass `false`). */
  hideable?: boolean;
  align?: "left" | "right";
  /** Header content; defaults to `label`. May be a client island (a sort header). */
  header?: ReactNode;
  cell: (row: T) => ReactNode;
  width?: number;
};

/**
 * Server-rendered data table: renders header + rows from a {@link ServerColumn}
 * list, skipping URL-hidden columns entirely (their cells never ship). No
 * `@tanstack/react-table` instance — the rows come pre-paged/sorted/filtered
 * from the server query, so this is a pure presentational server component that
 * streams inside a `<Suspense>`. Interactivity lives in the cell islands.
 */
export function ServerTable<T>({
  columns,
  rows,
  hiddenIds = [],
  getRowId,
  emptyState,
}: {
  columns: ServerColumn<T>[];
  rows: T[];
  hiddenIds?: string[];
  getRowId: (row: T) => string;
  emptyState: ReactNode;
}) {
  const hidden = new Set(hiddenIds);
  const visible = columns.filter((c) => !hidden.has(c.id));

  return (
    <div className="bg-card border-border overflow-x-auto rounded-3xl border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            {visible.map((c) => (
              <TableHead
                key={c.id}
                style={c.width ? { width: c.width } : undefined}
                className={c.align === "right" ? "text-right" : undefined}
              >
                {c.header ?? c.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={visible.length} className="h-40 p-0">
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={getRowId(row)}>
                {visible.map((c) => (
                  <TableCell
                    key={c.id}
                    className={c.align === "right" ? "text-right" : undefined}
                  >
                    {c.cell(row)}
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

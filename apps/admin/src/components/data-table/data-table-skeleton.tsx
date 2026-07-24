import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@loyalty/ui";

/**
 * Standalone table skeleton for route `loading.tsx` / Suspense fallbacks — no
 * `@tanstack/react-table` instance required (server-renderable), so it can paint
 * as the streaming fallback before any client JS runs. Mirrors the fetching
 * state that {@link DataTable} shows inline.
 */
export function DataTableSkeleton({
  columns = 6,
  rows = 8,
}: {
  columns?: number;
  rows?: number;
}) {
  return (
    <div className="bg-card border-border overflow-x-auto rounded-3xl border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columns }, (_, c) => (
              <TableHead key={c}>
                <Skeleton className="h-5 w-24" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }, (_, r) => (
            <TableRow key={r}>
              {Array.from({ length: columns }, (_, c) => (
                <TableCell key={c}>
                  <Skeleton className="h-5 w-full max-w-[140px]" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

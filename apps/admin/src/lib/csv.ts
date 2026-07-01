/** Tiny CSV builder + browser download. Used by data-table bulk "Export". */

type Cell = string | number | boolean | null | undefined;

function escape(value: Cell): string {
  if (value == null) return "";
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => Cell;
}

export function rowsToCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const head = columns.map((c) => escape(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escape(c.value(r))).join(",")).join("\n");
  return `${head}\n${body}`;
}

/** Trigger a client-side download of `content` as `filename`. */
export function downloadCsv(content: string, filename: string): void {
  // Prepend BOM so Excel reads UTF-8 (accents) correctly.
  const blob = new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Raw search params shape produced by Next's `searchParams` Promise.
 * Strings come in untyped; this module turns them into our list-input
 * shape with defaults + enum validation.
 */
export type RawSearchParams = Record<string, string | undefined>;

export const PAGE_SIZE = 25;

export type OutboxStatus = "sent" | "failed";

export type OutboxListParams = {
  to: string | undefined;
  status: OutboxStatus | undefined;
  search: string | undefined;
  page: number;
  pageSize: number;
};

export function parseOutboxSearchParams(sp: RawSearchParams): OutboxListParams {
  return {
    to: sp.to || undefined,
    status: parseStatus(sp.status),
    search: sp.search || undefined,
    page: parsePage(sp.page),
    pageSize: PAGE_SIZE,
  };
}

function parsePage(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function parseStatus(raw: string | undefined): OutboxStatus | undefined {
  return raw === "sent" || raw === "failed" ? raw : undefined;
}

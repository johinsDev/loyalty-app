/**
 * Raw search params shape produced by Next's `searchParams` Promise.
 * Mirrors `sms-outbox/lib/parse-search-params.ts`.
 */
export type RawSearchParams = Record<string, string | undefined>;

export const PAGE_SIZE = 25;

export type EmailOutboxStatus = "sent" | "failed";

export type EmailListParams = {
  to: string | undefined;
  status: EmailOutboxStatus | undefined;
  search: string | undefined;
  page: number;
  pageSize: number;
};

export function parseEmailSearchParams(
  sp: RawSearchParams,
): EmailListParams {
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

function parseStatus(raw: string | undefined): EmailOutboxStatus | undefined {
  return raw === "sent" || raw === "failed" ? raw : undefined;
}

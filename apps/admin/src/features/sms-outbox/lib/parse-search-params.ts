/**
 * Raw search params shape produced by Next's `searchParams` Promise.
 * Mirrors `whatsapp-outbox/lib/parse-search-params.ts`.
 */
export type RawSearchParams = Record<string, string | undefined>;

export const PAGE_SIZE = 25;

export type SmsOutboxStatus = "sent" | "failed";

export type SmsListParams = {
  to: string | undefined;
  status: SmsOutboxStatus | undefined;
  search: string | undefined;
  page: number;
  pageSize: number;
};

export function parseSmsSearchParams(sp: RawSearchParams): SmsListParams {
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

function parseStatus(raw: string | undefined): SmsOutboxStatus | undefined {
  return raw === "sent" || raw === "failed" ? raw : undefined;
}

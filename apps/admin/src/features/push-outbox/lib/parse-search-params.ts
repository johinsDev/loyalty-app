/**
 * Raw search params shape produced by Next's `searchParams` Promise.
 * Mirrors `email-outbox/lib/parse-search-params.ts`.
 */
export type RawSearchParams = Record<string, string | undefined>;

export const PAGE_SIZE = 25;

export type PushOutboxStatus = "sent" | "failed";
export type PushOutboxPlatform = "webpush" | "expo";

export type PushListParams = {
  deviceToken: string | undefined;
  platform: PushOutboxPlatform | undefined;
  status: PushOutboxStatus | undefined;
  search: string | undefined;
  page: number;
  pageSize: number;
};

export function parsePushSearchParams(sp: RawSearchParams): PushListParams {
  return {
    deviceToken: sp.deviceToken || undefined,
    platform: parsePlatform(sp.platform),
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

function parseStatus(raw: string | undefined): PushOutboxStatus | undefined {
  return raw === "sent" || raw === "failed" ? raw : undefined;
}

function parsePlatform(
  raw: string | undefined,
): PushOutboxPlatform | undefined {
  return raw === "webpush" || raw === "expo" ? raw : undefined;
}

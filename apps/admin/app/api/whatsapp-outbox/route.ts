import { NextResponse } from "next/server";

import { isDevOnlyEnabled } from "@/lib/dev-only";
import { trpc } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * E2E hook. Returns the most recent rows in `whatsapp_outbox`, optionally
 * filtered by `?to=<phone>`. Disabled in production deploys — Playwright
 * only ever calls this against local dev or Vercel preview URLs.
 *
 * Delegates to the tRPC `whatsappOutbox.list` procedure so the Drizzle
 * query lives in `packages/api/src/features/whatsapp-outbox/repository.ts`
 * — the only file in the feature that touches the db.
 */
export async function GET(request: Request) {
  if (!isDevOnlyEnabled()) {
    return new NextResponse("not found", { status: 404 });
  }

  const url = new URL(request.url);
  const to = url.searchParams.get("to") ?? undefined;
  const parsedLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  const pageSize = Math.min(
    Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  const api = await trpc();
  const { rows } = await api.whatsappOutbox.list({ to, pageSize, page: 1 });

  return NextResponse.json({ rows });
}

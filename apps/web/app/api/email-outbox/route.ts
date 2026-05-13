import { NextResponse } from "next/server";

import { isDevOnlyEnabled } from "@/lib/dev-only";
import { trpc } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * E2E hook. Returns the most recent rows in `email_outbox`, optionally
 * filtered by `?to=<address>`. Disabled in production deploys.
 *
 * Delegates to the tRPC `emailOutbox.list` procedure so the Drizzle
 * query lives in `packages/api/src/features/email-outbox/repository.ts`
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
  const { rows } = await api.emailOutbox.list({ to, pageSize, page: 1 });

  return NextResponse.json({ rows });
}

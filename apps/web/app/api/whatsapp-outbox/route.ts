import { db } from "@loyalty/db";
import { whatsappOutbox } from "@loyalty/db/schema";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isOutboxEndpointEnabled } from "./gate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * E2E hook. Returns the most recent rows in `whatsapp_outbox`, optionally
 * filtered by `?to=<phone>`. Disabled in production deploys — Playwright
 * only ever calls this against local dev or Vercel preview URLs.
 */
export async function GET(request: Request) {
  if (!isOutboxEndpointEnabled()) {
    return new NextResponse("not found", { status: 404 });
  }

  const url = new URL(request.url);
  const to = url.searchParams.get("to");
  const limit = Math.min(
    Number.parseInt(url.searchParams.get("limit") ?? "20", 10) || 20,
    100,
  );

  const query = db.select().from(whatsappOutbox);
  const rows = await (to
    ? query.where(eq(whatsappOutbox.to, to))
    : query
  )
    .orderBy(desc(whatsappOutbox.sentAt))
    .limit(limit);

  return NextResponse.json({ rows });
}

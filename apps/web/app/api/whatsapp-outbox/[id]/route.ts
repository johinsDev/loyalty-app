import { db } from "@loyalty/db";
import { whatsappOutbox } from "@loyalty/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { isDevOnlyEnabled } from "@/lib/dev-only";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * E2E hook for fetching a single row by id. Disabled in production.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDevOnlyEnabled()) {
    return new NextResponse("not found", { status: 404 });
  }

  const { id } = await params;
  const rows = await db
    .select()
    .from(whatsappOutbox)
    .where(eq(whatsappOutbox.id, id))
    .limit(1);
  const row = rows[0];

  if (!row) return new NextResponse("not found", { status: 404 });
  return NextResponse.json(row);
}

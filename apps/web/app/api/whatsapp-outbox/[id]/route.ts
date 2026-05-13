import { TRPCError } from "@trpc/server";
import { NextResponse } from "next/server";

import { isDevOnlyEnabled } from "@/lib/dev-only";
import { trpc } from "@/lib/trpc/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * E2E hook for fetching a single row by id. Disabled in production.
 *
 * Delegates to the tRPC `whatsappOutbox.get` procedure. The service
 * raises `TRPCError({ code: "NOT_FOUND" })` for missing rows; we map
 * NOT_FOUND + BAD_REQUEST (invalid UUID) to HTTP 404 here so the
 * endpoint stays opaque to test runners.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isDevOnlyEnabled()) {
    return new NextResponse("not found", { status: 404 });
  }

  const { id } = await params;
  const api = await trpc();

  try {
    const row = await api.whatsappOutbox.get({ id });
    return NextResponse.json(row);
  } catch (error) {
    if (
      error instanceof TRPCError &&
      (error.code === "NOT_FOUND" || error.code === "BAD_REQUEST")
    ) {
      return new NextResponse("not found", { status: 404 });
    }
    throw error;
  }
}

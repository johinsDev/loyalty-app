import { FileNotFoundError, verifyStorageToken } from "@loyalty/storage";
import { NextResponse } from "next/server";

import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SECRET = process.env.REALTIME_AUTH_SECRET ?? "";

/**
 * Serves bytes from the `local` + `memory` providers. R2 downloads
 * NEVER hit this — clients fetch directly from Cloudflare via
 * presigned GET URLs.
 *
 * Flow:
 *   1. Read `?token=<jwt>` from the query
 *   2. Verify HMAC + expiry + that the token's mode is "get"
 *   3. Stream the body with the stored `Content-Type`
 */
export async function GET(request: Request): Promise<Response> {
  if (!SECRET) {
    return new NextResponse("server missing REALTIME_AUTH_SECRET", {
      status: 500,
    });
  }
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new NextResponse("missing token", { status: 401 });

  let payload;
  try {
    payload = await verifyStorageToken({
      token,
      secret: SECRET,
      expectedMode: "get",
    });
  } catch {
    return new NextResponse("invalid token", { status: 401 });
  }

  try {
    const { body, file } = await storage.disk(payload.disk as "default").get(payload.key);
    return new NextResponse(new Blob([body as unknown as ArrayBuffer]), {
      status: 200,
      headers: {
        "content-type": file.contentType ?? "application/octet-stream",
        "content-length": String(file.size),
        "cache-control": "private, max-age=300",
      },
    });
  } catch (err) {
    if (err instanceof FileNotFoundError) {
      return new NextResponse("not found", { status: 404 });
    }
    return new NextResponse(
      err instanceof Error ? err.message : "read failed",
      { status: 500 },
    );
  }
}

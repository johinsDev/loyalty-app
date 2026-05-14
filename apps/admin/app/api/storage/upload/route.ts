import { FileTooLargeError, verifyStorageToken } from "@loyalty/storage";
import { NextResponse } from "next/server";

import { storage } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SECRET = process.env.REALTIME_AUTH_SECRET ?? "";

export async function PUT(request: Request): Promise<Response> {
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
      expectedMode: "put",
    });
  } catch {
    return new NextResponse("invalid token", { status: 401 });
  }

  const contentType =
    request.headers.get("content-type") ?? payload.contentType ?? "application/octet-stream";
  const contentLength = Number.parseInt(
    request.headers.get("content-length") ?? "0",
    10,
  );
  if (
    payload.maxSize !== undefined &&
    Number.isFinite(contentLength) &&
    contentLength > payload.maxSize
  ) {
    return new NextResponse("file too large", { status: 413 });
  }

  if (!request.body) return new NextResponse("missing body", { status: 400 });

  try {
    const buf = new Uint8Array(await request.arrayBuffer());
    if (payload.maxSize !== undefined && buf.byteLength > payload.maxSize) {
      throw new FileTooLargeError(buf.byteLength, payload.maxSize);
    }
    await storage.disk(payload.disk as "default").put(payload.key, buf, { contentType });
  } catch (err) {
    if (err instanceof FileTooLargeError) {
      return new NextResponse(err.message, { status: 413 });
    }
    return new NextResponse(
      err instanceof Error ? err.message : "upload failed",
      { status: 500 },
    );
  }
  return new NextResponse(null, { status: 204 });
}

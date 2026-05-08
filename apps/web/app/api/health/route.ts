import { NextResponse } from "next/server";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const time = new Date().toISOString();
  log.debug({ route: "/api/health", service: "web" }, "health probe");
  return NextResponse.json({
    status: "ok",
    service: "web",
    time,
  });
}

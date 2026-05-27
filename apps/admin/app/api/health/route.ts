import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@loyalty/db/client";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const time = new Date().toISOString();
  let dbReachable = false;
  let dbError: string | undefined;

  try {
    await db.run(sql`select 1`);
    dbReachable = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : "unknown error";
    log.error(
      { route: "/api/health", service: "admin", err },
      "db unreachable",
    );
  }

  const body = {
    status: dbReachable ? "ok" : "degraded",
    service: "admin",
    time,
    deps: {
      db: { reachable: dbReachable, ...(dbError && { error: dbError }) },
    },
  };

  return NextResponse.json(body, { status: dbReachable ? 200 : 503 });
}

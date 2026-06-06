import { NextResponse } from "next/server";
import { env } from "@/env";
import { log } from "@/lib/log";

export const dynamic = "force-dynamic";

/**
 * Liveness + upstream check. The admin CRM is a thin client of the API
 * Worker (`api.t4diverclub.app`) — it owns no DB — so health pings the
 * Worker (the dependency it actually has) rather than the database.
 */
export async function GET() {
  const time = new Date().toISOString();
  const apiUrl = env.NEXT_PUBLIC_API_URL;
  let apiReachable = false;
  let apiError: string | undefined;

  if (!apiUrl) {
    apiError = "NEXT_PUBLIC_API_URL not set";
  } else {
    try {
      const res = await fetch(new URL("/", apiUrl), {
        signal: AbortSignal.timeout(5000),
      });
      apiReachable = res.ok;
      if (!res.ok) apiError = `api responded ${res.status}`;
    } catch (err) {
      apiError = err instanceof Error ? err.message : "unknown error";
    }
  }

  if (!apiReachable) {
    log.error(
      { route: "/api/health", service: "admin", apiUrl, err: apiError },
      "api worker unreachable",
    );
  }

  const body = {
    status: apiReachable ? "ok" : "degraded",
    service: "admin",
    time,
    deps: {
      api: { reachable: apiReachable, ...(apiError && { error: apiError }) },
    },
  };

  return NextResponse.json(body, { status: apiReachable ? 200 : 503 });
}

import "server-only";

import type { AppRouter } from "@loyalty/api";
import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";
import type { inferRouterOutputs } from "@trpc/server";
import { cacheLife, cacheTag } from "next/cache";
import superjson from "superjson";

import { getTrpcUrl } from "@/lib/trpc/shared";

type Branding = inferRouterOutputs<AppRouter>["settings"]["branding"];

/**
 * Tenant branding (brand color + SEO favicon…). `settings.branding` is a
 * **public** procedure, so this fetches it **without** the session cookie — which
 * is what lets the whole thing live inside a `"use cache"` boundary (`cookies()`/
 * `headers()` are forbidden there). Cached cross-request on a `minutes` profile
 * (branding is mutable admin state — this preserves the ~60s staleness the
 * Worker read-cache already had, rather than widening it to hours) and tagged
 * `branding` so an `updateBranding` mutation can `revalidateTag("branding")` for
 * instant reflection. Returns `null` when unset/unreachable → app defaults.
 * Keeping this off the dynamic path is what lets the root layout + `[locale]`
 * metadata prerender as a static shell under `cacheComponents`.
 */
export async function getBranding(): Promise<Branding | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("branding");

  const client = createTRPCUntypedClient<AppRouter>({
    links: [httpBatchLink({ url: getTrpcUrl(), transformer: superjson })],
  });
  return (client.query("settings.branding", undefined) as Promise<Branding>).catch(
    () => null,
  );
}

import "server-only";

import type { AppRouter } from "@loyalty/api";
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { headers } from "next/headers";
import { cache, type ReactNode } from "react";
import superjson from "superjson";

import { getTrpcUrl } from "./shared";

/**
 * Server-side tRPC prefetch + hydration for live data (the customer card). A
 * Server Component prefetches a query into a per-request QueryClient, then wraps
 * the client tree in `<HydrateClient>` so the matching client `useQuery`
 * (`useTRPC().x.queryOptions()`) hydrates with no loading flash. After mount,
 * the realtime listener invalidates those queries for a live update.
 *
 * Same query-key factory as the client (`createTRPCContext`), so keys match. We
 * forward the request cookie and read `no-store` (auth-scoped data).
 */
export const getQueryClient = cache(
  () =>
    new QueryClient({
      defaultOptions: { queries: { staleTime: 30_000 } },
    }),
);

/** A request-scoped server tRPC proxy producing `queryOptions()` with the same
 *  keys the client uses. Async because it reads the request cookie. */
export const getServerTrpc = cache(async () => {
  const cookie = (await headers()).get("cookie") ?? "";
  const client = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: getTrpcUrl(),
        transformer: superjson,
        headers: () => (cookie ? { cookie } : {}),
        fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }),
      }),
    ],
  });
  return createTRPCOptionsProxy<AppRouter>({
    client,
    queryClient: getQueryClient(),
  });
});

/** Dehydrates the per-request QueryClient so client `useQuery`s hydrate. */
export function HydrateClient({ children }: { children: ReactNode }) {
  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      {children}
    </HydrationBoundary>
  );
}

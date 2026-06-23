import {
  defaultShouldDehydrateQuery,
  QueryClient,
} from "@tanstack/react-query";
import superjson from "superjson";

/**
 * Single QueryClient factory shared by the client provider and the server
 * prefetch helper. The streaming bits matter:
 *  - `shouldDehydrateQuery` also dehydrates **pending** queries, so a server
 *    `void prefetchQuery(...)` streams its in-flight promise into the HTML
 *    instead of blocking the document (the card shell renders immediately, the
 *    data fills in).
 *  - `serializeData` / `deserializeData` = superjson, matching the tRPC link
 *    transformer, so `Date`s (purchase timestamps) survive dehydration.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000, refetchOnWindowFocus: false },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
      hydrate: { deserializeData: superjson.deserialize },
    },
  });
}

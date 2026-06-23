import { Suspense } from "react";

import { env } from "@/env";
import { getSession } from "@/lib/auth-guard";
import {
  getQueryClient,
  getServerTrpc,
  HydrateClient,
} from "@/lib/trpc/server-prefetch";

import { CardLive } from "./card-live";
import { CardSkeleton } from "./card-skeleton";
import { StampEarnedListener } from "./stamp-earned-listener";

/**
 * Loyalty card screen. Kicks off the wallet / history / completed-wallets
 * prefetches WITHOUT awaiting (`void`) so the in-flight promises stream into the
 * dehydrated state; `<CardLive />` reads them with `useSuspenseQuery`, so the
 * shell renders immediately behind `<CardSkeleton />` and fills in as the data
 * arrives. The `<StampEarnedListener />` then invalidates those queries live.
 */
export async function CardView() {
  const session = await getSession();
  const customerId = session?.user?.id ?? null;

  const queryClient = getQueryClient();
  const trpc = await getServerTrpc();
  // void = stream, don't block the document. Registered before HydrateClient
  // dehydrates, so the pending queries are serialized into the HTML.
  void queryClient.prefetchQuery(trpc.sellos.myWallet.queryOptions());
  void queryClient.prefetchQuery(
    trpc.sellos.myHistory.queryOptions({ page: 1, pageSize: 20 }),
  );
  void queryClient.prefetchQuery(trpc.sellos.myCompletedWallets.queryOptions());

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-5">
      <HydrateClient>
        <Suspense fallback={<CardSkeleton />}>
          <CardLive />
        </Suspense>
      </HydrateClient>
      {customerId ? (
        <StampEarnedListener
          customerId={customerId}
          partykitHost={env.NEXT_PUBLIC_PARTYKIT_HOST}
        />
      ) : null}
    </main>
  );
}

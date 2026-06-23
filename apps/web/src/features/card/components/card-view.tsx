import { Suspense } from "react";

import { env } from "@/env";
import { getSession } from "@/lib/auth-guard";
import {
  getQueryClient,
  getServerTrpc,
  HydrateClient,
} from "@/lib/trpc/server-prefetch";

import { CompletedWallets } from "./completed-wallets";
import { HistorySkeleton, WalletCardSkeleton } from "./card-skeleton";
import { PurchaseHistory } from "./purchase-history";
import { StampEarnedListener } from "./stamp-earned-listener";
import { WalletCard } from "./wallet-card";

/**
 * Loyalty card screen. Each live section is its own island with its own
 * `<Suspense>` boundary, so they stream + update independently rather than one
 * giant component waiting on all three queries. The prefetches are fired with
 * `void` (no blocking) before `HydrateClient` dehydrates the pending queries;
 * `<StampEarnedListener />` invalidates them on realtime events.
 */
export async function CardView() {
  const session = await getSession();
  const customerId = session?.user?.id ?? null;

  const queryClient = getQueryClient();
  const trpc = await getServerTrpc();
  void queryClient.prefetchQuery(trpc.sellos.myWallet.queryOptions());
  void queryClient.prefetchQuery(
    trpc.sellos.myHistory.queryOptions({ page: 1, pageSize: 20 }),
  );
  void queryClient.prefetchQuery(trpc.sellos.myCompletedWallets.queryOptions());

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-5">
      <HydrateClient>
        <Suspense fallback={<WalletCardSkeleton />}>
          <WalletCard />
        </Suspense>
        <CompletedWallets />
        <Suspense fallback={<HistorySkeleton />}>
          <PurchaseHistory />
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

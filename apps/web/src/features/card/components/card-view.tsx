import { env } from "@/env";
import { getSession } from "@/lib/auth-guard";
import {
  getQueryClient,
  getServerTrpc,
  HydrateClient,
} from "@/lib/trpc/server-prefetch";

import { CardLive } from "./card-live";
import { StampEarnedListener } from "./stamp-earned-listener";

/**
 * Loyalty card screen. Prefetches the customer's wallet / history / completed
 * wallets on the server (hydrated into the client, no loading flash), then
 * `<CardLive />` reads them with `useQuery` and the `<StampEarnedListener />`
 * invalidates them live when the cashier grants a stamp or confirms a claim.
 */
export async function CardView() {
  const session = await getSession();
  const customerId = session?.user?.id ?? null;

  const queryClient = getQueryClient();
  const trpc = await getServerTrpc();
  await Promise.all([
    queryClient.prefetchQuery(trpc.sellos.myWallet.queryOptions()),
    queryClient.prefetchQuery(
      trpc.sellos.myHistory.queryOptions({ page: 1, pageSize: 20 }),
    ),
    queryClient.prefetchQuery(trpc.sellos.myCompletedWallets.queryOptions()),
  ]);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-5">
      <HydrateClient>
        <CardLive />
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

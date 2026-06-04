"use client";

import type { AppRouter } from "@loyalty/api";
import type { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink, loggerLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { type ReactNode, useState } from "react";
import superjson from "superjson";

import { getTrpcUrl } from "./shared";

export const { TRPCProvider: TRPCContextProvider, useTRPC } =
  createTRPCContext<AppRouter>();

const makeClient = () =>
  createTRPCClient<AppRouter>({
    links: [
      loggerLink({
        enabled: (op) =>
          process.env.NODE_ENV === "development" ||
          (op.direction === "down" && op.result instanceof Error),
      }),
      httpBatchLink({
        url: getTrpcUrl(),
        transformer: superjson,
        // Send cookies to the (possibly cross-origin) Worker API.
        fetch: (url, opts) => fetch(url, { ...opts, credentials: "include" }),
      }),
    ],
  });

export const TRPCProvider = ({
  children,
  queryClient,
}: {
  children: ReactNode;
  queryClient: QueryClient;
}) => {
  const [trpcClient] = useState(makeClient);

  return (
    <TRPCContextProvider trpcClient={trpcClient} queryClient={queryClient}>
      {children}
    </TRPCContextProvider>
  );
};

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
        // Tell the Worker the active locale + currency so it returns localized
        // content + per-currency prices (read fresh from cookies per request).
        headers: () => {
          if (typeof document === "undefined") return {};
          const read = (name: string) =>
            document.cookie
              .split("; ")
              .find((c) => c.startsWith(`${name}=`))
              ?.split("=")[1];
          const out: Record<string, string> = {};
          const locale = read("NEXT_LOCALE");
          const currency = read("NEXT_CURRENCY");
          if (locale) out["x-locale"] = decodeURIComponent(locale);
          if (currency) out["x-currency"] = decodeURIComponent(currency);
          return out;
        },
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

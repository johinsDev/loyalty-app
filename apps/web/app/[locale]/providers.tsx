"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { type ReactNode, useState } from "react";

import { TRPCProvider } from "@/lib/trpc/client";

/**
 * Single roof for all client-side context: i18n (next-intl), URL state
 * (nuqs), data fetching (TanStack Query), and tRPC. Server reads the
 * active locale + messages and passes them in; everything below this
 * component runs in the client.
 */
type Props = {
  children: ReactNode;
  locale: string;
  /** `getMessages()` result — wide structural type to avoid coupling. */
  messages: Record<string, unknown>;
};

export const Providers = ({ children, locale, messages }: Props) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="America/Bogota"
    >
      <NuqsAdapter>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient}>{children}</TRPCProvider>
        </QueryClientProvider>
      </NuqsAdapter>
    </NextIntlClientProvider>
  );
};

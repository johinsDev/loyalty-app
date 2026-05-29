"use client";

import { AnalyticsProvider } from "@loyalty/analytics/react";
import { FlagsProvider } from "@loyalty/feature-flags/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { type ReactNode, useState } from "react";

import { TRPCProvider } from "@/lib/trpc/client";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const ENVIRONMENT =
  process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

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
          <TRPCProvider queryClient={queryClient}>
            <AnalyticsProvider
              provider={POSTHOG_KEY ? "posthog" : "null"}
              apiKey={POSTHOG_KEY}
              host={POSTHOG_HOST}
              app="web"
              environment={ENVIRONMENT}
              locale={locale}
            >
              <FlagsProvider
                provider={POSTHOG_KEY ? "posthog" : "null"}
                apiKey={POSTHOG_KEY}
                host={POSTHOG_HOST}
              >
                {children}
              </FlagsProvider>
            </AnalyticsProvider>
          </TRPCProvider>
        </QueryClientProvider>
      </NuqsAdapter>
    </NextIntlClientProvider>
  );
};

"use client";

import { AnalyticsProvider } from "@loyalty/analytics/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { type ReactNode, useState } from "react";

import { TRPCProvider } from "@/lib/trpc/client";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const ENVIRONMENT =
  process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

export const Providers = ({ children }: { children: ReactNode }) => {
  const locale = useLocale();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <NuqsAdapter>
      <QueryClientProvider client={queryClient}>
        <TRPCProvider queryClient={queryClient}>
          <AnalyticsProvider
            provider={POSTHOG_KEY ? "posthog" : "null"}
            apiKey={POSTHOG_KEY}
            host={POSTHOG_HOST}
            app="admin"
            environment={ENVIRONMENT}
            locale={locale}
          >
            {children}
          </AnalyticsProvider>
        </TRPCProvider>
      </QueryClientProvider>
    </NuqsAdapter>
  );
};

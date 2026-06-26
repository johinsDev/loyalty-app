"use client";

import { AnalyticsProvider } from "@loyalty/analytics/react";
import { FlagsProvider } from "@loyalty/feature-flags/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { type ReactNode, useState } from "react";

import { type Branding, BrandingProvider } from "@/lib/branding";
import { CurrencyProvider } from "@/lib/currency";
import { TRPCProvider } from "@/lib/trpc/client";
import { makeQueryClient } from "@/lib/trpc/query-client";

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
  /**
   * Server render time, shared with the client so `format.relativeTime` has a
   * stable reference and next-intl doesn't fall back to the runtime clock
   * (which logs an `ENVIRONMENT_FALLBACK` error per call).
   */
  now: Date;
  /** Org branding fetched server-side (shared via context, no client fetch). */
  branding: Branding | null;
};

export const Providers = ({ children, locale, messages, now, branding }: Props) => {
  const [queryClient] = useState(makeQueryClient);

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="America/Bogota"
      now={now}
    >
      <NuqsAdapter>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient}>
            <CurrencyProvider>
            <BrandingProvider branding={branding}>
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
            </BrandingProvider>
            </CurrencyProvider>
          </TRPCProvider>
        </QueryClientProvider>
      </NuqsAdapter>
    </NextIntlClientProvider>
  );
};

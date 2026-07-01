import { Toaster } from "@loyalty/ui";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { FloatingChrome } from "@/components/floating-chrome";
import { routing } from "@/i18n/routing";
import { trpc } from "@/lib/trpc/server";

import { Providers } from "./providers";

/** Tenant-configurable favicon (Settings → SEO). Null when unset/unreachable →
 *  the app's default icon. */
async function faviconUrl(): Promise<string | null> {
  try {
    const branding = await (await trpc()).settings.branding();
    return branding.seo.faviconUrl ?? null;
  } catch {
    return null;
  }
}

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Metadata" });
  const favicon = await faviconUrl();
  return {
    title: t("title"),
    description: t("description"),
    ...(favicon ? { icons: { icon: favicon } } : {}),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);

  return (
    <NextIntlClientProvider>
      <FloatingChrome />
      <Providers>{children}</Providers>
      <Toaster position="top-right" />
    </NextIntlClientProvider>
  );
}

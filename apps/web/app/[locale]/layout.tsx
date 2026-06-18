import { Toaster } from "@loyalty/ui";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AppChrome } from "@/components/app-chrome";
import { env } from "@/env";
import { NotificationsDrawer } from "@/features/notifications/components/notifications-drawer";
import { NotificationsOnEntry } from "@/features/notifications/components/notifications-on-entry";
import { RealtimeNotifications } from "@/features/realtime/components/realtime-notifications";
import { routing } from "@/i18n/routing";

import { Providers } from "./providers";

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
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <Providers locale={locale} messages={messages}>
      <AppChrome />
      {children}
      <RealtimeNotifications host={env.NEXT_PUBLIC_PARTYKIT_HOST} />
      <NotificationsDrawer />
      <NotificationsOnEntry />
      <Toaster position="top-center" />
    </Providers>
  );
}

import { Toaster } from "@loyalty/ui";
import { hasLocale } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { AppChrome } from "@/components/app-chrome";
import { BottomNav } from "@/components/bottom-nav";
import { env } from "@/env";
import { NotificationsDrawer } from "@/features/notifications/components/notifications-drawer";
import { NotificationsOnEntry } from "@/features/notifications/components/notifications-on-entry";
import { QrDrawer } from "@/features/qr/components/qr-drawer";
import { RealtimeNotifications } from "@/features/realtime/components/realtime-notifications";
import { routing } from "@/i18n/routing";
import { trpc } from "@/lib/trpc/server";

import { Providers } from "./providers";

type Props = {
  children: ReactNode;
  /** Parallel slot for intercepted detail modals (e.g. `/banner/[slug]`). */
  modal: ReactNode;
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

export default async function LocaleLayout({ children, modal, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();
  const branding = await (await trpc({ locale })).settings.branding().catch(() => null);

  return (
    <Providers locale={locale} messages={messages} now={new Date()} branding={branding}>
      <AppChrome />
      {children}
      {modal}
      <BottomNav />
      <RealtimeNotifications host={env.NEXT_PUBLIC_PARTYKIT_HOST} />
      <NotificationsDrawer />
      <NotificationsOnEntry />
      <QrDrawer />
      <Toaster position="top-center" />
    </Providers>
  );
}

import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { OutboxList } from "@/features/whatsapp-outbox/components/outbox-list";
import { isDevOnlyEnabled } from "@/lib/dev-only";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function WhatsAppOutboxPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (!isDevOnlyEnabled()) notFound();
  return <OutboxList searchParams={await searchParams} />;
}

import { setRequestLocale } from "next-intl/server";

import { OutboxList } from "@/features/whatsapp-outbox/components/outbox-list";

type Props = { params: Promise<{ locale: string }> };

export default async function WhatsAppOutboxPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OutboxList />;
}

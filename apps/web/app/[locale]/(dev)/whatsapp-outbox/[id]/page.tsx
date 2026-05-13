import { setRequestLocale } from "next-intl/server";

import { OutboxDetail } from "@/features/whatsapp-outbox/components/outbox-detail";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function WhatsAppOutboxDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <OutboxDetail id={id} />;
}

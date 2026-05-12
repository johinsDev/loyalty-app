import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { OutboxDetail } from "@/features/whatsapp-outbox/components/outbox-detail";
import { isDevOnlyEnabled } from "@/lib/dev-only";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function WhatsAppOutboxDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  if (!isDevOnlyEnabled()) notFound();
  return <OutboxDetail id={id} />;
}

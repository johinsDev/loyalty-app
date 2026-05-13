import { setRequestLocale } from "next-intl/server";

import { OutboxDetail } from "@/features/sms-outbox/components/outbox-detail";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function SmsOutboxDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <OutboxDetail id={id} />;
}

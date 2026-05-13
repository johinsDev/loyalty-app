import { setRequestLocale } from "next-intl/server";

import { OutboxList } from "@/features/sms-outbox/components/outbox-list";

type Props = { params: Promise<{ locale: string }> };

export default async function SmsOutboxPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OutboxList />;
}

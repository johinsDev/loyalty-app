import { setRequestLocale } from "next-intl/server";

import { OutboxList } from "@/features/sms-outbox/components/outbox-list";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function SmsOutboxPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OutboxList searchParams={await searchParams} />;
}

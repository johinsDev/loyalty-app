import { setRequestLocale } from "next-intl/server";

import { OutboxList } from "@/features/email-outbox/components/outbox-list";

type Props = { params: Promise<{ locale: string }> };

export default async function EmailOutboxPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <OutboxList />;
}

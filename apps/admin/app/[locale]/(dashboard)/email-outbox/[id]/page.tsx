import { setRequestLocale } from "next-intl/server";

import { OutboxDetail } from "@/features/email-outbox/components/outbox-detail";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function EmailOutboxDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <OutboxDetail id={id} />;
}

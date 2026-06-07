import { setRequestLocale } from "next-intl/server";

import { NotificationsView } from "@/features/notifications/components/notifications-view";
import { requireCustomer } from "@/lib/auth-guard";

type Props = { params: Promise<{ locale: string }> };

export default async function NotificationsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomer();
  return <NotificationsView />;
}

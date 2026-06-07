import { setRequestLocale } from "next-intl/server";

import { ProfileView } from "@/features/profile/components/profile-view";
import { requireCustomer } from "@/lib/auth-guard";

type Props = { params: Promise<{ locale: string }> };

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomer();
  return <ProfileView />;
}

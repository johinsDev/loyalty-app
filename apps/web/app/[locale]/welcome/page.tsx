import { setRequestLocale } from "next-intl/server";

import { WelcomeScreen } from "@/features/welcome/components/welcome-screen";
import { requireCustomer } from "@/lib/auth-guard";

type Props = { params: Promise<{ locale: string }> };

export default async function WelcomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomer();
  return <WelcomeScreen />;
}

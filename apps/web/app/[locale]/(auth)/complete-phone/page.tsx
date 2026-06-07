import { setRequestLocale } from "next-intl/server";

import { CompletePhoneForm } from "@/features/auth/components/complete-phone-form";
import { requireSession } from "@/lib/auth-guard";

type Props = { params: Promise<{ locale: string }> };

export default async function CompletePhonePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Requires a session but NOT a customer — this IS the page that turns a
  // phone-less (Google) user into a customer, so guarding with
  // `requireCustomer` here would loop.
  await requireSession();
  return <CompletePhoneForm />;
}

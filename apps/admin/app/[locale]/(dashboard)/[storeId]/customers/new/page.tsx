import { setRequestLocale } from "next-intl/server";

import { CustomerWizard } from "@/features/customers/components/customer-wizard";

type Props = { params: Promise<{ locale: string }> };

export default async function NewCustomerPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CustomerWizard />;
}

import { setRequestLocale } from "next-intl/server";

import { CustomerWizard } from "@/features/customers/components/customer-wizard";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function EditCustomerPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <CustomerWizard id={id} />;
}

import { setRequestLocale } from "next-intl/server";

import { CustomerDetailView } from "@/features/customers/components/customer-detail-view";
import { getCustomer } from "@/features/customers/data";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function CustomerPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  return <CustomerDetailView customer={getCustomer(id)} />;
}

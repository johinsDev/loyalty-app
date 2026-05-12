import { setRequestLocale } from "next-intl/server";

import { CustomersView } from "@/features/customers/components/customers-view";

type Props = { params: Promise<{ locale: string }> };

export default async function CustomersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CustomersView />;
}

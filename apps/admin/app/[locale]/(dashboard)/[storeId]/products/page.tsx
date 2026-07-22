import { setRequestLocale } from "next-intl/server";

import { ProductsView } from "@/features/products/components/products-view";

type Props = { params: Promise<{ locale: string }> };

export default async function ProductsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProductsView />;
}

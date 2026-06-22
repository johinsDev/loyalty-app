import { setRequestLocale } from "next-intl/server";

import { ProductWizard } from "@/features/products/components/product-wizard";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function EditProductPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <ProductWizard id={id} />;
}

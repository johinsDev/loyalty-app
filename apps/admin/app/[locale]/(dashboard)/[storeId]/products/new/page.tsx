import { setRequestLocale } from "next-intl/server";

import { ProductEditor } from "@/features/products/components/product-editor";

type Props = { params: Promise<{ locale: string }> };

export default async function NewProductPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ProductEditor />;
}

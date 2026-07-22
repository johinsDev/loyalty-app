import { setRequestLocale } from "next-intl/server";

import { ProductEditor } from "@/features/products/components/product-editor";

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function EditProductPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <ProductEditor id={id} />;
}

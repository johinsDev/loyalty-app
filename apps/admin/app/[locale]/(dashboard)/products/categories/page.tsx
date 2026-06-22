import { setRequestLocale } from "next-intl/server";

import { CategoriesView } from "@/features/products/components/categories-view";

type Props = { params: Promise<{ locale: string }> };

export default async function ProductCategoriesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CategoriesView />;
}

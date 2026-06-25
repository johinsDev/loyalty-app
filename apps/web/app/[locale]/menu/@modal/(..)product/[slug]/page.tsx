import { ProductModal } from "@/features/menu/components/product-modal";

type Props = { params: Promise<{ slug: string }> };

/** Intercepted detail: opens the product as a modal over the menu. */
export default async function InterceptedProductPage({ params }: Props) {
  const { slug } = await params;
  return <ProductModal slug={slug} />;
}

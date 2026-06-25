import { PromoModal } from "@/features/promos/components/promo-modal";

type Props = { params: Promise<{ slug: string }> };

/** Intercepted detail: opens the promo as a modal over the current page. */
export default async function InterceptedPromoPage({ params }: Props) {
  const { slug } = await params;
  return <PromoModal slug={slug} />;
}

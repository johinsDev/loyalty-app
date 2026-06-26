import { PurchaseModal } from "@/features/purchases/components/purchase-modal";

type Props = { params: Promise<{ id: string }> };

/** Intercepted detail: opens the purchase as a modal over the list. */
export default async function InterceptedPurchasePage({ params }: Props) {
  const { id } = await params;
  return <PurchaseModal id={id} />;
}

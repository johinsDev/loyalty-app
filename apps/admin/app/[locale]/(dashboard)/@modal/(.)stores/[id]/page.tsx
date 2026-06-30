import { StoreDetailModal } from "@/features/stores/components/store-detail-modal";

type Props = { params: Promise<{ id: string }> };

/** Intercepted detail: opens the store as a modal over the list. */
export default async function InterceptedStorePage({ params }: Props) {
  const { id } = await params;
  return <StoreDetailModal id={id} />;
}

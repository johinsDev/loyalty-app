import { BannerModal } from "@/features/banners/components/banner-modal";

type Props = { params: Promise<{ slug: string }> };

/** Intercepted detail: opens the banner as a modal over the home. */
export default async function InterceptedBannerPage({ params }: Props) {
  const { slug } = await params;
  return <BannerModal slug={slug} />;
}

import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { BannerDetailView } from "@/features/banners/components/banner-detail-view";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; id: string }> };

/** Full banner detail page — rendered on direct load / reload / share. In-app
 *  navigation from the list opens the `?detalle=` modal instead. */
export default async function BannerDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const api = await trpc();
  const banner = await api.banners.detail({ id }).catch(() => null);
  if (!banner) notFound();

  const t = await getTranslations({ locale, namespace: "Banners" });

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <Link
        href="/banners"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-bold"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>
      <div className="mt-2">
        <BannerDetailView banner={banner} variant="page" />
      </div>
    </div>
  );
}

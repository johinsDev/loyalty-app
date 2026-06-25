import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { BannerDetail } from "@/features/banners/components/banner-detail";
import { Link } from "@/i18n/navigation";
import { requireCustomer } from "@/lib/auth-guard";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const api = await trpc({ locale });
  const banner = await api.banners.bySlug({ slug }).catch(() => null);
  if (!banner) return {};
  const title = banner.seo.title ?? banner.name;
  const description = banner.seo.description ?? banner.shortDescription ?? undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: banner.seo.ogImageUrl ? [banner.seo.ogImageUrl] : undefined,
    },
  };
}

/** Full banner page (SEO) — rendered on direct load / reload / share. In-app
 *  navigation from the home intercepts this as a modal instead. */
export default async function BannerPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  await requireCustomer(); // v1 auth-gated; ready to go public later.

  const api = await trpc({ locale });
  const banner = await api.banners.bySlug({ slug });
  if (!banner) notFound();

  const t = await getTranslations({ locale, namespace: "Banners" });

  return (
    <div className="bg-background min-h-dvh">
      <div className="mx-auto w-full max-w-md px-1 pt-10 pb-28 md:pb-12 lg:max-w-2xl">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mb-4 ml-5 inline-flex items-center gap-1 text-sm font-bold"
        >
          <ArrowLeft className="size-4" />
          {t("backToHome")}
        </Link>
        <BannerDetail banner={banner} />
      </div>
    </div>
  );
}

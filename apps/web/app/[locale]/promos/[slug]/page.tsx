import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { PromoDetail } from "@/features/promos/components/promo-detail";
import { Link } from "@/i18n/navigation";
import { requireCustomer } from "@/lib/auth-guard";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const api = await trpc({ locale });
  const promo = await api.promociones.bySlug({ slug }).catch(() => null);
  if (!promo) return {};
  const title = promo.seo.title ?? promo.name;
  const description = promo.seo.description ?? promo.shortDescription ?? undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: promo.seo.ogImageUrl ? [promo.seo.ogImageUrl] : undefined,
    },
  };
}

/** Full promo page (SEO) — rendered on direct load / reload / share. In-app
 *  navigation intercepts this as a modal. */
export default async function PromoPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  await requireCustomer();

  const api = await trpc({ locale });
  const promo = await api.promociones.bySlug({ slug });
  if (!promo) notFound();

  const t = await getTranslations({ locale, namespace: "Promos" });

  return (
    <div className="bg-background min-h-dvh">
      <div className="mx-auto w-full max-w-md px-1 pt-10 pb-28 md:pb-12 lg:max-w-2xl">
        <Link
          href="/promos"
          className="text-muted-foreground hover:text-foreground mb-4 ml-5 inline-flex items-center gap-1 text-sm font-bold"
        >
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
        <PromoDetail promo={promo} />
      </div>
    </div>
  );
}

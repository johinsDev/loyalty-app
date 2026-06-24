import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { ProductDetail } from "@/features/menu/components/product-detail";
import { Link } from "@/i18n/navigation";
import { requireCustomer } from "@/lib/auth-guard";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const api = await trpc();
  const product = await api.menu.productBySlug({ slug }).catch(() => null);
  if (!product) return {};
  const title = product.seo.title ?? product.name;
  const description = product.seo.description ?? undefined;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: product.seo.ogImageUrl ? [product.seo.ogImageUrl] : undefined,
    },
  };
}

/** Full product page (SEO) — rendered on direct load / reload / share. In-app
 *  navigation from the menu intercepts this as a modal instead. */
export default async function ProductPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  await requireCustomer(); // v1 auth-gated; ready to go public later.

  const api = await trpc();
  const product = await api.menu.productBySlug({ slug });
  if (!product) notFound();

  const t = await getTranslations({ locale, namespace: "Menu" });

  return (
    <div className="bg-background min-h-dvh">
      <div className="mx-auto w-full max-w-md px-1 pt-10 pb-28 md:pb-12 lg:max-w-2xl">
        <Link
          href="/menu"
          className="text-muted-foreground hover:text-foreground mb-4 ml-5 inline-flex items-center gap-1 text-sm font-bold"
        >
          <ArrowLeft className="size-4" />
          {t("backToMenu")}
        </Link>
        <ProductDetail product={product} />
      </div>
    </div>
  );
}

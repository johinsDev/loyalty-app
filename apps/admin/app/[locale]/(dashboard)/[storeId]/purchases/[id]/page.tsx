import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { PurchaseDetailView } from "@/features/purchases/components/purchase-detail-view";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; storeId: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Purchases" });
  return { title: t("receipt") };
}

/** Full purchase "radiografía" page — rendered on direct load / reload / share.
 *  In-app navigation from the list opens the `?detalle=` modal instead. */
export default async function PurchaseDetailPage({ params }: Props) {
  const { locale, storeId, id } = await params;
  setRequestLocale(locale);

  const api = await trpc();
  const detail = await api.purchases.adminGet({ id }).catch(() => null);
  if (!detail) notFound();

  const t = await getTranslations({ locale, namespace: "Purchases" });

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <Link
        href={{ pathname: "/[storeId]/purchases", params: { storeId } }}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-bold"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>
      <div className="mt-2">
        <PurchaseDetailView detail={detail} variant="page" />
      </div>
    </div>
  );
}

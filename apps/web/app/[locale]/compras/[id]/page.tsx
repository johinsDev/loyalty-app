import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { PurchaseDetailView } from "@/features/purchases/components/purchase-detail-view";
import { Link } from "@/i18n/navigation";
import { requireCustomer } from "@/lib/auth-guard";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "Purchases" });
  const api = await trpc({ locale });
  const detail = await api.purchases.purchaseDetail({ id }).catch(() => null);
  if (!detail) return {};
  return { title: t("title") };
}

/** Full purchase detail page — rendered on direct load / reload / share. In-app
 *  navigation from the list intercepts this as a modal instead. */
export default async function PurchaseDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  await requireCustomer();

  const api = await trpc({ locale });
  const detail = await api.purchases.purchaseDetail({ id }).catch(() => null);
  if (!detail) notFound();

  const t = await getTranslations({ locale, namespace: "Purchases" });

  return (
    <div className="bg-background min-h-dvh">
      <div className="mx-auto w-full max-w-md px-1 pt-10 pb-28 md:pb-12 lg:max-w-2xl">
        <Link
          href="/compras"
          className="text-muted-foreground hover:text-foreground mb-4 ml-5 inline-flex items-center gap-1 text-sm font-bold"
        >
          <ArrowLeft className="size-4" />
          {t("back")}
        </Link>
        <PurchaseDetailView detail={detail} variant="page" />
      </div>
    </div>
  );
}

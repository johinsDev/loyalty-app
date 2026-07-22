import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { CampaignDetailView } from "@/features/campaigns/components/campaign-detail-view";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; storeId: string; id: string }> };

/** Full campaign detail page — rendered on direct load / reload / share. In-app
 *  navigation from the list opens the `?detalle=` modal instead. */
export default async function CampaignDetailPage({ params }: Props) {
  const { locale, storeId, id } = await params;
  setRequestLocale(locale);

  const api = await trpc();
  const campaign = await api.campaigns.detail({ id }).catch(() => null);
  if (!campaign) notFound();

  const t = await getTranslations({ locale, namespace: "Campaigns" });

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <Link
        href={{ pathname: "/[storeId]/campaigns", params: { storeId } }}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-bold"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>
      <div className="mt-2">
        <CampaignDetailView campaign={campaign} variant="page" />
      </div>
    </div>
  );
}

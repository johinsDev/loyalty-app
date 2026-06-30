import { ArrowLeft } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { StoreDetailView } from "@/features/stores/components/store-detail-view";
import { Link } from "@/i18n/navigation";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; id: string }> };

/** Full store detail page — rendered on direct load / reload / share. In-app
 *  navigation from the list intercepts this as a modal instead. */
export default async function StoreDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const api = await trpc();
  const store = await api.stores.get({ id }).catch(() => null);
  if (!store) notFound();

  const t = await getTranslations({ locale, namespace: "Stores" });

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6 lg:px-8">
      <Link
        href="/stores"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm font-bold"
      >
        <ArrowLeft className="size-4" />
        {t("title")}
      </Link>
      <StoreDetailView store={store} variant="page" />
    </div>
  );
}

import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { Customer360 } from "@/features/customers/components/customer-360";
import { trpc } from "@/lib/trpc/server";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Customers" });
  return { title: t("title") };
}

/** Customer 360 — identity + stats resolved server-side; each tab streams its
 *  own cursor-paginated data client-side. */
export default async function CustomerPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const api = await trpc();
  const [detail, stats] = await Promise.all([
    api.customers.adminGet({ customerId: id }).catch(() => null),
    api.customers.stats({ customerId: id }).catch(() => null),
  ]);
  if (!detail || !stats) notFound();

  return <Customer360 detail={detail} stats={stats} />;
}

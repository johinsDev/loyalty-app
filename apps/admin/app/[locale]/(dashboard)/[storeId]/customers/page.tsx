import { setRequestLocale } from "next-intl/server";

import { CustomersKpis } from "@/features/customers/components/customers-kpis";
import { CustomersListHeader } from "@/features/customers/components/customers-list-header";
import { CustomersView } from "@/features/customers/components/customers-view";

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * Customers list — a client-cached table (react-query + nuqs). The page is a
 * shell with NO server data `await`, so navigating here is instant (a server
 * `await` on the list would block the soft navigation until the Worker responds
 * — the ~1-2s hang the RSC-prefetch caused). `CustomersView`'s `useQuery` paints
 * from its client cache on re-entry (instant, no skeleton) and only fetches on a
 * genuinely new filter. We deliberately drop the server prefetch: the client
 * cache already gives the instant re-entry we wanted; SSR-first-paint on a hard
 * reload isn't worth blocking every in-app navigation for an authed admin.
 */
export default async function CustomersPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <CustomersListHeader />
      <CustomersKpis />
      <CustomersView />
    </div>
  );
}

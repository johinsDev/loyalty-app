import { getFormatter, getTranslations } from "next-intl/server";
import type { SearchParams } from "nuqs/server";

import { money } from "@/lib/money";
import { trpc } from "@/lib/trpc/server";

import { buildPurchasesInput, loadPurchasesSearchParams } from "../list-params";

/**
 * Purchases KPI strip — honors the active filters, so it's a server component in
 * its own Suspense hole reading the same input as the table (keyed on the filter
 * slice, it re-streams when a filter changes).
 */
export async function PurchasesKpis({
  searchParams,
  storeId,
}: {
  searchParams: SearchParams;
  storeId: string | null;
}) {
  const t = await getTranslations("Purchases");
  const format = await getFormatter();
  const loaded = loadPurchasesSearchParams(searchParams);
  const input = buildPurchasesInput(storeId ? { ...loaded, store: [storeId] } : loaded);
  const kpis = await (await trpc()).purchases.adminKpis(input);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label={t("kpi.count")} value={String(kpis.count)} />
      <Kpi label={t("kpi.revenue")} value={money(format, kpis.netRevenueCents)} />
      <Kpi label={t("kpi.avgTicket")} value={money(format, kpis.avgTicketCents)} />
      <Kpi label={t("kpi.promoRate")} value={`${Math.round(kpis.promoRate * 100)}%`} />
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-card border-border min-w-0 rounded-3xl border p-5 shadow-sm">
      <span className="text-muted-foreground/70 text-xs font-extrabold tracking-wider uppercase">
        {label}
      </span>
      <div className="font-display mt-1 text-2xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

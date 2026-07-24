import { Badge, Skeleton } from "@loyalty/ui";
import { AlertTriangle, Sparkles } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { Suspense } from "react";

import {
  CardSkeleton,
  ChartCard,
  KpiRowSkeleton,
  ListSkeletonRows,
} from "@/features/dashboard/components/dashboard-primitives";
import { PeriodBar } from "@/features/dashboard/components/period-bar";
import { SetupChecklist } from "@/features/dashboard/components/setup-checklist";
import * as W from "@/features/dashboard/components/widgets";
import { loadDashboardSearchParams } from "@/features/dashboard/list-params";
import { CampaignsKpiStrip } from "@/features/campaigns/components/campaigns-kpi-strip";
import { DashboardPromoCard } from "@/features/promotions/components/dashboard-promo-card";
import { PromoKpiStrip } from "@/features/promotions/components/promo-kpi-strip";
import { loadStoreScope } from "@/lib/store-scope-server";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

/**
 * Admin dashboard — a static shell (chrome + card frames + titles paint
 * instantly) with each stat/chart as its own server component in its own
 * `<Suspense>` hole, awaiting its own `dashboard.*` query. The period lives in
 * the URL ({@link PeriodBar}); period-dependent widgets are keyed on it so they
 * re-skeleton on a switch, period-independent ones stream once and stay. Store
 * scope comes from the `[storeId]` segment (resolution is cached by the layout).
 */
export default async function DashboardPage({ params, searchParams }: Props) {
  const { locale, storeId: segment } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Dashboard");
  const { period } = loadDashboardSearchParams(await searchParams);
  const { scope } = await loadStoreScope(segment);
  const storeId = scope?.storeId ?? null;
  const wp = { period, storeId };

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-6 lg:px-8">
      <SetupChecklist />
      <PeriodBar />

      {/* ROI hero — static shell, revenue streams */}
      <section className="from-primary to-primary/80 relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-br p-6 text-white shadow-xl">
        <span className="absolute -top-16 -right-10 size-56 rounded-full bg-white/10" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-extrabold tracking-wider">
            <Sparkles className="size-3.5" />
            {t("impactTitle")}
          </span>
          <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
            <Suspense
              key={period}
              fallback={
                <div>
                  <Skeleton className="h-12 w-40 bg-white/25" />
                  <Skeleton className="mt-2 h-4 w-52 bg-white/20" />
                </div>
              }
            >
              <W.HeroRevenue {...wp} />
            </Suspense>
            <div className="flex flex-col gap-1">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-extrabold">
                {t("comingSoon")}
              </span>
              <span className="text-xs font-semibold text-white/70">{t("impactComingSoon")}</span>
            </div>
          </div>
        </div>
      </section>

      {/* KPI row */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Suspense key={period} fallback={<KpiRowSkeleton />}>
          <W.KpiRow {...wp} />
        </Suspense>
      </div>

      {/* Campaigns + promos — client islands with their own loading */}
      <div className="mt-3">
        <CampaignsKpiStrip />
      </div>
      <div className="mt-3">
        <PromoKpiStrip />
      </div>

      {/* Purchases trend + tier mix */}
      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartCard
          title={t("purchasesTitle")}
          subtitle={t("purchasesSubtitle")}
          className="lg:col-span-2"
        >
          <div className="h-52">
            <Suspense key={period} fallback={<Skeleton className="size-full rounded-xl" />}>
              <W.PurchasesTrend {...wp} />
            </Suspense>
          </div>
        </ChartCard>
        <Suspense fallback={<CardSkeleton title={t("tiersTitle")} />}>
          <W.TierCard />
        </Suspense>
      </div>

      {/* DAU (coming soon) + redemptions trend */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={t("dauTitle")} subtitle={t("dauSubtitle")}>
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <Badge variant="secondary" className="text-xs">
              {t("comingSoon")}
            </Badge>
            <p className="text-muted-foreground max-w-56 text-xs font-semibold">
              {t("dauComingSoon")}
            </p>
          </div>
        </ChartCard>
        <ChartCard title={t("redemptionTitle")} subtitle={t("redemptionSubtitle")}>
          <div className="h-40">
            <Suspense key={period} fallback={<Skeleton className="size-full rounded-xl" />}>
              <W.RedemptionsTrend {...wp} />
            </Suspense>
          </div>
        </ChartCard>
      </div>

      {/* Cohorts + promo performance (island) */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={t("cohortsTitle")} subtitle={t("cohortsSubtitle")}>
          <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
            <W.CohortsTable />
          </Suspense>
        </ChartCard>
        <DashboardPromoCard />
      </div>

      {/* Recent purchases + top customers */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={t("recentPurchasesTitle")} liveLabel={t("live")}>
          <Suspense fallback={<ListSkeletonRows rows={6} />}>
            <W.RecentPurchases storeId={storeId} />
          </Suspense>
        </ChartCard>
        <ChartCard title={t("topCustomersTitle")} subtitle={t("topCustomersSubtitle")}>
          <Suspense key={period} fallback={<ListSkeletonRows rows={6} />}>
            <W.TopCustomers {...wp} />
          </Suspense>
        </ChartCard>
      </div>

      {/* At-risk + fraud (coming soon) + recent claims */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartCard title={t("atRiskTitle")} subtitle={t("atRiskSubtitle")}>
          <Suspense fallback={<ListSkeletonRows rows={5} />}>
            <W.AtRisk storeId={storeId} />
          </Suspense>
        </ChartCard>
        <ChartCard title={t("fraudTitle")} subtitle={t("fraudSubtitle")}>
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-2xl">
              <AlertTriangle className="size-5" />
            </span>
            <Badge variant="secondary" className="text-xs">
              {t("comingSoon")}
            </Badge>
            <p className="text-muted-foreground max-w-56 text-xs font-semibold">
              {t("fraudComingSoon")}
            </p>
          </div>
        </ChartCard>
        <ChartCard title={t("recentClaimsTitle")}>
          <Suspense fallback={<ListSkeletonRows rows={6} />}>
            <W.RecentClaims />
          </Suspense>
        </ChartCard>
      </div>

      {/* Retention + program liability */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={t("retentionTitle")} subtitle={t("retentionSubtitle")}>
          <Suspense key={period} fallback={<Skeleton className="h-16 w-full rounded-xl" />}>
            <W.RetentionStats period={period} />
          </Suspense>
        </ChartCard>
        <ChartCard title={t("liabilityTitle")} subtitle={t("liabilitySubtitle")}>
          <Suspense key={period} fallback={<Skeleton className="h-16 w-full rounded-xl" />}>
            <W.LiabilityStats period={period} />
          </Suspense>
        </ChartCard>
      </div>

      {/* Top products + sales by store */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={t("topProductsTitle")} subtitle={t("topProductsSubtitle")}>
          <Suspense key={period} fallback={<ListSkeletonRows rows={6} />}>
            <W.TopProducts {...wp} />
          </Suspense>
        </ChartCard>
        <ChartCard title={t("salesByStoreTitle")}>
          <Suspense key={period} fallback={<ListSkeletonRows rows={3} />}>
            <W.SalesByStore period={period} />
          </Suspense>
        </ChartCard>
      </div>
    </div>
  );
}

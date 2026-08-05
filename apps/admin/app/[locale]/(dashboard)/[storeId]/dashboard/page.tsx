import { Badge, Skeleton } from "@loyalty/ui";
import { AlertTriangle, Sparkles } from "lucide-react";
import { setRequestLocale } from "next-intl/server";
import type { SearchParams } from "nuqs/server";
import { type ReactNode, Suspense } from "react";

import { IslandBoundary } from "@/components/island-boundary";
import {
  CardSkeleton,
  ChartCard,
  KpiRowSkeleton,
  ListSkeletonRows,
} from "@/features/dashboard/components/dashboard-primitives";
import { SeriesSubtitle } from "@/features/dashboard/components/series-subtitle";
import { DText } from "@/features/dashboard/components/dashboard-text";
import { PeriodBar } from "@/features/dashboard/components/period-bar";
import { SetupChecklist } from "@/features/dashboard/components/setup-checklist";
import * as W from "@/features/dashboard/components/widgets";
import { type DashboardPeriod, loadDashboardSearchParams } from "@/features/dashboard/list-params";
import { CampaignsKpiStrip } from "@/features/campaigns/components/campaigns-kpi-strip";
import { DashboardPromoCard } from "@/features/promotions/components/dashboard-promo-card";
import { PromoKpiStrip } from "@/features/promotions/components/promo-kpi-strip";
import { loadStoreScope } from "@/lib/store-scope-server";

type Props = {
  params: Promise<{ locale: string; storeId: string }>;
  searchParams: Promise<SearchParams>;
};

type Wp = { period: DashboardPeriod; storeId: string | null };

/** Resolve a widget's `{period, storeId}` — the `storeId` hop (`loadStoreScope`,
 *  request-cached → one real round-trip shared by all widgets) and the `period`
 *  (searchParams) both live here so they run INSIDE a Suspense hole, never at the
 *  page top (a top-level `await` of either de-opts the static shell and freezes
 *  navigation, the customers-list bug). Also sets the request locale here so the
 *  server widgets' `getTranslations`/`getFormatter` resolve inside the hole. */
async function widgetProps(
  params: Props["params"],
  searchParams: Props["searchParams"],
): Promise<Wp> {
  const [{ locale, storeId: segment }, sp] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);
  const { scope } = await loadStoreScope(segment);
  const { period } = loadDashboardSearchParams(sp);
  return { period, storeId: scope?.storeId ?? null };
}

/**
 * A dashboard widget hole. Resolves `{period, storeId}` in-hole (see
 * {@link widgetProps}) then renders the widget. `keyed` wraps it in an inner
 * `<Suspense key={period}>` so the widget re-skeletons on a period switch
 * (period-dependent widgets); omit it for period-independent widgets so they
 * stream once and stay across a switch.
 */
async function Widget({
  params,
  searchParams,
  fallback,
  keyed = false,
  render,
}: {
  params: Props["params"];
  searchParams: Props["searchParams"];
  fallback: ReactNode;
  keyed?: boolean;
  render: (wp: Wp) => ReactNode;
}) {
  const wp = await widgetProps(params, searchParams);
  return keyed ? (
    <Suspense key={wp.period} fallback={fallback}>
      {render(wp)}
    </Suspense>
  ) : (
    render(wp)
  );
}

/**
 * A dashboard widget hole: an {@link IslandBoundary} (degrades a single failed
 * widget to an inline retry, keeping the rest of the dashboard alive) wrapping
 * the `<Suspense>` that streams it. `bare` because each already sits inside a
 * `ChartCard`/section frame, so the retry renders inline without a second border.
 */
function Hole({ fallback, children }: { fallback: ReactNode; children: ReactNode }) {
  return (
    <IslandBoundary bare>
      <Suspense fallback={fallback}>{children}</Suspense>
    </IslandBoundary>
  );
}

/**
 * Admin dashboard — a **static** shell (chrome + card frames + titles paint
 * instantly) with each stat/chart as its own `<Suspense>` hole. Nothing is
 * `await`ed at the top: titles render via the client {@link DText} (SSR'd from
 * the intl provider) and store scope + period resolve inside each hole (via
 * {@link Widget}), so the shell prerenders and navigating here is instant — the
 * widgets stream in behind their skeletons. Period-dependent widgets re-skeleton
 * on a switch (inner keyed Suspense); period-independent ones stream once. Each
 * hole is an {@link Hole} (error boundary + Suspense) so one widget blip degrades
 * to an inline retry instead of tripping the route-level `error.tsx`.
 */
export default function DashboardPage({ params, searchParams }: Props) {
  const box = { params, searchParams };
  const heroFallback = (
    <div>
      <Skeleton className="h-12 w-40 bg-white/25" />
      <Skeleton className="mt-2 h-4 w-52 bg-white/20" />
    </div>
  );

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
            <DText k="impactTitle" />
          </span>
          <div className="mt-4 flex flex-wrap items-end gap-x-10 gap-y-4">
            <Hole fallback={heroFallback}>
              <Widget
                {...box}
                keyed
                fallback={heroFallback}
                render={(wp) => <W.HeroRevenue {...wp} />}
              />
            </Hole>
            <div className="flex flex-col gap-1">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-extrabold">
                <DText k="comingSoon" />
              </span>
              <span className="text-xs font-semibold text-white/70">
                <DText k="impactComingSoon" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* KPI row */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Hole fallback={<KpiRowSkeleton />}>
          <Widget
            {...box}
            keyed
            fallback={<KpiRowSkeleton />}
            render={(wp) => <W.KpiRow {...wp} />}
          />
        </Hole>
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
          title={<DText k="purchasesTitle" />}
          subtitle={<SeriesSubtitle k="purchasesSubtitle" />}
          className="lg:col-span-2"
        >
          <div className="h-52">
            <Hole fallback={<Skeleton className="size-full rounded-xl" />}>
              <Widget
                {...box}
                keyed
                fallback={<Skeleton className="size-full rounded-xl" />}
                render={(wp) => <W.PurchasesTrend {...wp} />}
              />
            </Hole>
          </div>
        </ChartCard>
        <Hole fallback={<CardSkeleton title={<DText k="tiersTitle" />} />}>
          <W.TierCard />
        </Hole>
      </div>

      {/* DAU (coming soon) + redemptions trend */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={<DText k="dauTitle" />} subtitle={<DText k="dauSubtitle" />}>
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
            <Badge variant="secondary" className="text-xs">
              <DText k="comingSoon" />
            </Badge>
            <p className="text-muted-foreground max-w-56 text-xs font-semibold">
              <DText k="dauComingSoon" />
            </p>
          </div>
        </ChartCard>
        <ChartCard title={<DText k="redemptionTitle" />} subtitle={<SeriesSubtitle k="redemptionSubtitle" />}>
          <div className="h-40">
            <Hole fallback={<Skeleton className="size-full rounded-xl" />}>
              <Widget
                {...box}
                keyed
                fallback={<Skeleton className="size-full rounded-xl" />}
                render={(wp) => <W.RedemptionsTrend {...wp} />}
              />
            </Hole>
          </div>
        </ChartCard>
      </div>

      {/* Cohorts + promo performance (island) */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={<DText k="cohortsTitle" />} subtitle={<DText k="cohortsSubtitle" />}>
          <Hole fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
            <W.CohortsTable />
          </Hole>
        </ChartCard>
        <DashboardPromoCard />
      </div>

      {/* Recent purchases + top customers */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={<DText k="recentPurchasesTitle" />} liveLabel={<DText k="live" />}>
          <Hole fallback={<ListSkeletonRows rows={6} />}>
            <Widget
              {...box}
              fallback={<ListSkeletonRows rows={6} />}
              render={(wp) => <W.RecentPurchases storeId={wp.storeId} />}
            />
          </Hole>
        </ChartCard>
        <ChartCard
          title={<DText k="topCustomersTitle" />}
          subtitle={<DText k="topCustomersSubtitle" />}
        >
          <Hole fallback={<ListSkeletonRows rows={6} />}>
            <Widget
              {...box}
              keyed
              fallback={<ListSkeletonRows rows={6} />}
              render={(wp) => <W.TopCustomers {...wp} />}
            />
          </Hole>
        </ChartCard>
      </div>

      {/* At-risk + fraud (coming soon) + recent claims */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <ChartCard title={<DText k="atRiskTitle" />} subtitle={<DText k="atRiskSubtitle" />}>
          <Hole fallback={<ListSkeletonRows rows={5} />}>
            <Widget
              {...box}
              fallback={<ListSkeletonRows rows={5} />}
              render={(wp) => <W.AtRisk storeId={wp.storeId} />}
            />
          </Hole>
        </ChartCard>
        <ChartCard title={<DText k="fraudTitle" />} subtitle={<DText k="fraudSubtitle" />}>
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <span className="bg-muted text-muted-foreground grid size-11 place-items-center rounded-2xl">
              <AlertTriangle className="size-5" />
            </span>
            <Badge variant="secondary" className="text-xs">
              <DText k="comingSoon" />
            </Badge>
            <p className="text-muted-foreground max-w-56 text-xs font-semibold">
              <DText k="fraudComingSoon" />
            </p>
          </div>
        </ChartCard>
        <ChartCard title={<DText k="recentClaimsTitle" />}>
          <Hole fallback={<ListSkeletonRows rows={6} />}>
            <W.RecentClaims />
          </Hole>
        </ChartCard>
      </div>

      {/* Retention + program liability */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={<DText k="retentionTitle" />} subtitle={<DText k="retentionSubtitle" />}>
          <Hole fallback={<Skeleton className="h-16 w-full rounded-xl" />}>
            <Widget
              {...box}
              keyed
              fallback={<Skeleton className="h-16 w-full rounded-xl" />}
              render={(wp) => <W.RetentionStats period={wp.period} />}
            />
          </Hole>
        </ChartCard>
        <ChartCard title={<DText k="liabilityTitle" />} subtitle={<DText k="liabilitySubtitle" />}>
          <Hole fallback={<Skeleton className="h-16 w-full rounded-xl" />}>
            <Widget
              {...box}
              keyed
              fallback={<Skeleton className="h-16 w-full rounded-xl" />}
              render={(wp) => <W.LiabilityStats period={wp.period} />}
            />
          </Hole>
        </ChartCard>
      </div>

      {/* Top products + sales by store */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title={<DText k="topProductsTitle" />} subtitle={<DText k="topProductsSubtitle" />}>
          <Hole fallback={<ListSkeletonRows rows={6} />}>
            <Widget
              {...box}
              keyed
              fallback={<ListSkeletonRows rows={6} />}
              render={(wp) => <W.TopProducts {...wp} />}
            />
          </Hole>
        </ChartCard>
        <ChartCard
          title={<DText k="categoryMixTitle" />}
          subtitle={<DText k="categoryMixSubtitle" />}
        >
          <Hole fallback={<ListSkeletonRows rows={5} />}>
            <Widget
              {...box}
              keyed
              fallback={<ListSkeletonRows rows={5} />}
              render={(wp) => <W.CategoryMix {...wp} />}
            />
          </Hole>
        </ChartCard>
        <ChartCard title={<DText k="salesByStoreTitle" />}>
          <Hole fallback={<ListSkeletonRows rows={3} />}>
            <Widget
              {...box}
              keyed
              fallback={<ListSkeletonRows rows={3} />}
              render={(wp) => <W.SalesByStore period={wp.period} />}
            />
          </Hole>
        </ChartCard>
      </div>
    </div>
  );
}

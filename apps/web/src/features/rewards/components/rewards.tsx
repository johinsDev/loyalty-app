import { SidebarInset, SidebarProvider } from "@loyalty/ui";
import { getTranslations } from "next-intl/server";

import { AppSidebar } from "@/features/home/components/app-sidebar";

import { RecentRedemptions } from "./recent-redemptions";
import { RewardsBalance } from "./rewards-balance";
import { RewardsCatalog } from "./rewards-catalog";
import { TierCard } from "./tier-card";

/**
 * Customer rewards — the stamps/points reward catalog wired to `rewards.*`:
 * claimable + coming-up + locked + redeemed rewards, the tier card with
 * next-level progress and benefits, a search box, filter chips, curated section
 * rows, and recent redemptions. Mobile-first; on desktop the tier card becomes a
 * sticky aside next to the catalog and the bottom nav gives way to the sidebar.
 * This RSC is the routing shell; the data-bearing pieces are client components
 * (per-user + protected queries the cross-origin Worker can't SSR-authenticate).
 */
export async function Rewards() {
  const t = await getTranslations("Rewards");

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset className="from-primary/5 to-background text-foreground overflow-x-clip bg-gradient-to-b">
        <div className="mx-auto w-full max-w-md px-5 pt-14 pb-32 md:pb-12 lg:max-w-5xl lg:px-8 lg:pt-12">
          <header className="mb-5 flex items-center justify-between gap-3">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {t("title")}
            </h1>
            <RewardsBalance />
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-1">
              <div className="lg:sticky lg:top-12">
                <TierCard />
              </div>
            </div>
            <div className="min-w-0 lg:col-span-2">
              <RewardsCatalog />
            </div>
          </div>

          <div className="mt-8">
            <RecentRedemptions />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

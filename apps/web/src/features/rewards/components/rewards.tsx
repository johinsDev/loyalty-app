import { SidebarInset, SidebarProvider } from "@loyalty/ui";
import { getTranslations } from "next-intl/server";

import { stampsBalance } from "../data";
import { RecentRedemptions } from "./recent-redemptions";
import { RewardsCatalog } from "./rewards-catalog";
import { TierCard } from "./tier-card";
import { AppSidebar } from "@/features/home/components/app-sidebar";
import { BottomNav } from "@/features/home/components/bottom-nav";

/**
 * Customer rewards — a faithful build of the "T4 · Recompensas (Sellos)" Claude
 * Design template. Stamp-currency catalog: claimable + coming-up rewards, the
 * tier card with next-level progress and benefits, a search box, filter chips,
 * and recent redemptions. Mobile-first; on desktop the tier card becomes a
 * sticky aside next to the catalog and the bottom nav gives way to the sidebar.
 * All data is hardcoded sample content (see `../data`) until the rewards API
 * lands; the catalog and its drawer are the only interactive (client) parts.
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
            <span className="bg-card text-primary inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-extrabold whitespace-nowrap shadow-sm ring-1 ring-black/5 dark:ring-white/10">
              🧋 {t("balance", { count: stampsBalance })}
            </span>
          </header>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <div className="lg:sticky lg:top-12">
                <TierCard />
              </div>
            </div>
            <div className="lg:col-span-2">
              <RewardsCatalog />
            </div>
          </div>

          <div className="mt-8">
            <RecentRedemptions />
          </div>
        </div>

        <BottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}

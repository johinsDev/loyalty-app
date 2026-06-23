import { SidebarInset, SidebarProvider } from "@loyalty/ui";
import { getTranslations } from "next-intl/server";

import { env } from "@/env";
import { FadeUp } from "@/lib/animate";
import { getSession } from "@/lib/auth-guard";

import { AppSidebar } from "./app-sidebar";
import { GreetingHeader } from "./greeting-header";
import { PointsCard } from "./points-card";
import { PromosCarousel } from "./promos-carousel";
import { RecentVisits } from "./recent-visits";
import { RewardCard } from "./reward-card";
import { ScanCta } from "./scan-cta";
import { StampEarnedListener } from "./stamp-earned-listener";
import { StampsCard } from "./stamps-card";
import { StreakCard } from "./streak-card";
import { Usuals } from "./usuals";

/**
 * Customer home — a faithful build of the "T4 Lovers · Home / Sellos" Claude
 * Design templates. Mobile-first (the phone design) with a wider desktop
 * variation: a collapsible sidebar (md+) replaces the bottom nav, and the
 * wallet cards sit side by side. All data is hardcoded sample content (see
 * `../data`); both wallet models — points ring and stamp card — are shown.
 */
export async function Home() {
  const t = await getTranslations("Home");
  const session = await getSession();
  const customerId = session?.user?.id ?? null;

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset className="from-primary/5 to-background text-foreground overflow-x-clip bg-gradient-to-b">
        <div className="mx-auto w-full max-w-md px-5 pt-14 pb-32 md:pb-12 lg:max-w-5xl lg:px-8 lg:pt-12">
          <FadeUp index={0}>
            <GreetingHeader />
          </FadeUp>

          {/* Wallet models — points ring (design mock) + the real stamp card. */}
          <FadeUp index={1} className="mt-5 grid gap-4 lg:grid-cols-2">
            <PointsCard />
            <StampsCard />
          </FadeUp>

          <FadeUp index={2} className="mt-4">
            <StreakCard />
          </FadeUp>

          <FadeUp index={3} className="mt-4">
            <ScanCta />
          </FadeUp>

          <FadeUp index={4} className="mt-6">
            <p className="text-muted-foreground mb-3 text-xs font-bold tracking-wider">
              {t("readyToClaim")}
            </p>
            <RewardCard />
          </FadeUp>

          <FadeUp index={5} className="mt-6">
            <PromosCarousel />
          </FadeUp>

          <FadeUp
            index={6}
            className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2"
          >
            <div className="min-w-0">
              <Usuals />
            </div>
            <div className="min-w-0">
              <RecentVisits />
            </div>
          </FadeUp>
        </div>

        {customerId ? (
          <StampEarnedListener
            customerId={customerId}
            partykitHost={env.NEXT_PUBLIC_PARTYKIT_HOST}
          />
        ) : null}
      </SidebarInset>
    </SidebarProvider>
  );
}

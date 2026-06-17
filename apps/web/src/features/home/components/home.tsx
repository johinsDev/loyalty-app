import { getTranslations } from "next-intl/server";

import { BottomNav } from "./bottom-nav";
import { GreetingHeader } from "./greeting-header";
import { PointsCard } from "./points-card";
import { PromosCarousel } from "./promos-carousel";
import { RecentVisits } from "./recent-visits";
import { RewardCard } from "./reward-card";
import { ScanCta } from "./scan-cta";
import { StampsCard } from "./stamps-card";
import { Usuals } from "./usuals";

/**
 * Customer home — a faithful build of the "T4 Lovers · Home / Sellos" Claude
 * Design templates. Mobile-first (the phone design) with a wider desktop
 * variation at `lg`. All data is hardcoded sample content (see `../data`); both
 * wallet models — points ring and stamp card — are shown side by side.
 */
export async function Home() {
  const t = await getTranslations("Home");

  return (
    <main className="min-h-[100dvh] bg-[#eef3f2] text-foreground dark:bg-background">
      <div className="mx-auto w-full max-w-md px-5 pt-14 pb-32 lg:max-w-5xl lg:px-8 lg:pt-12">
        <GreetingHeader />

        {/* Wallet models — points ring + stamp card, side by side on desktop. */}
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <PointsCard />
          <StampsCard />
        </div>

        <div className="mt-4">
          <ScanCta />
        </div>

        <section className="mt-6">
          <p className="text-muted-foreground mb-3 text-xs font-bold tracking-wider">
            {t("readyToClaim")}
          </p>
          <RewardCard />
        </section>

        <div className="mt-6">
          <PromosCarousel />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Usuals />
          <RecentVisits />
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

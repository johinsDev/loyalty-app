import { SidebarInset, SidebarProvider } from "@loyalty/ui";
import { getTranslations } from "next-intl/server";

import { promos } from "../data";
import { PromosCatalog } from "./promos-catalog";
import { AppSidebar } from "@/features/home/components/app-sidebar";
import { BottomNav } from "@/features/home/components/bottom-nav";

/**
 * Customer promos hub — a faithful build of the "T4 · Promos" Claude Design
 * template: a "destacadas" hero carousel, category filter chips, the list of all
 * active promos, and a bottom Drawer with a promo's detail + register code.
 * Mobile-first; on desktop the bottom nav gives way to the sidebar and the
 * layout widens. All data is hardcoded sample content (see `../data`) until the
 * customer promos API lands; the catalog and its drawer are the interactive
 * (client) parts. Reached from the home "para ti hoy" carousel.
 */
export async function Promos() {
  const t = await getTranslations("Promos");

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset className="from-primary/5 to-background text-foreground overflow-x-clip bg-gradient-to-b">
        <div className="mx-auto w-full max-w-md px-5 pt-14 pb-32 md:pb-12 lg:max-w-5xl lg:px-8 lg:pt-12">
          <header className="mb-5">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {t("title")}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              {t("subtitle", { count: promos.length })}
            </p>
          </header>

          <PromosCatalog />
        </div>

        <BottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}

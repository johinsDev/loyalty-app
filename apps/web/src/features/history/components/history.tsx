import { SidebarInset, SidebarProvider } from "@loyalty/ui";
import { getTranslations } from "next-intl/server";

import { AppSidebar } from "@/features/home/components/app-sidebar";

import { HistoryView } from "./history-view";

/**
 * Customer purchase history — a faithful build of the "T4 · Historial" Claude
 * Design template: a month summary, period filter chips, purchases grouped by
 * day, and a bottom Drawer with the itemized receipt. Mobile-first; on desktop
 * the bottom nav gives way to the sidebar and the layout widens. All data is
 * hardcoded sample content (see `../data`) until the purchases/ledger API lands;
 * the view and its drawer are the interactive (client) parts. Reached from the
 * home "recent visits" card and the points ring detail.
 */
export async function History() {
  const t = await getTranslations("History");

  return (
    <SidebarProvider
      style={{ "--sidebar-width": "18rem" } as React.CSSProperties}
    >
      <AppSidebar />
      <SidebarInset className="from-primary/5 to-background text-foreground overflow-x-clip bg-gradient-to-b">
        <div className="mx-auto w-full max-w-md px-5 pt-14 pb-32 md:pb-12 lg:max-w-5xl lg:px-8 lg:pt-12">
          <header className="mb-5">
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {t("title")}
            </h1>
          </header>

          <HistoryView />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

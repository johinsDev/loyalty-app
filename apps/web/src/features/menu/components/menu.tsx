import { SidebarInset, SidebarProvider } from "@loyalty/ui";

import { AppSidebar } from "@/features/home/components/app-sidebar";
import { BottomNav } from "@/features/home/components/bottom-nav";

import { MenuCatalog } from "./menu-catalog";

/**
 * Customer drinks menu — a faithful build of the "T4 · Menú" Claude Design
 * template. Mobile-first; on desktop the bottom nav gives way to the sidebar and
 * the grid widens. All data is hardcoded (see `../data`); search, filters,
 * favorites and the detail drawer live in the URL (nuqs) — see {@link MenuCatalog}.
 */
export function Menu() {
  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset className="from-primary/5 to-background text-foreground overflow-x-clip bg-gradient-to-b">
        <div className="mx-auto w-full max-w-md px-5 pt-14 pb-32 md:pb-12 lg:max-w-5xl lg:px-8 lg:pt-12">
          <MenuCatalog />
        </div>
        <BottomNav />
      </SidebarInset>
    </SidebarProvider>
  );
}

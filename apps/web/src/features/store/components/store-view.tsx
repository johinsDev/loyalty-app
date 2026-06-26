import { SidebarInset, SidebarProvider } from "@loyalty/ui";
import { getLocale, getTranslations } from "next-intl/server";

import { AppSidebar } from "@/features/home/components/app-sidebar";
import { FadeUp } from "@/lib/animate";
import { trpc } from "@/lib/trpc/server";

import { StoreScreen } from "./store-screen";

/**
 * Customer "Nuestra tienda" page. Fetches the org's published stores
 * (`stores.listPublic`) + brand social links; a client `StoreScreen` renders the
 * branch switcher (when >1), the static map, hours and the call/map/directions
 * actions. Reached from the profile screen.
 */
export async function StoreView() {
  const locale = await getLocale();
  const t = await getTranslations("Store");
  const api = await trpc({ locale });
  const [stores, branding] = await Promise.all([
    api.stores.listPublic().catch(() => []),
    api.settings.branding().catch(() => null),
  ]);

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset className="from-primary/5 to-background text-foreground overflow-x-clip bg-gradient-to-b">
        <div className="mx-auto w-full max-w-md px-5 pt-14 pb-32 md:pb-12 lg:max-w-3xl lg:px-8 lg:pt-12">
          <FadeUp index={0}>
            <header className="mb-5">
              <h1 className="font-display text-3xl font-semibold tracking-tight">{t("title")}</h1>
              <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
            </header>
          </FadeUp>

          {stores.length === 0 ? (
            <div className="border-border rounded-3xl border border-dashed p-12 text-center">
              <p className="font-semibold">{t("empty")}</p>
              <p className="text-muted-foreground mt-1 text-sm">{t("emptyHint")}</p>
            </div>
          ) : (
            <FadeUp index={1}>
              <StoreScreen stores={stores} social={branding?.socialLinks ?? {}} />
            </FadeUp>
          )}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

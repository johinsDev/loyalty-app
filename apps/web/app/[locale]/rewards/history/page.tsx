import { SidebarInset, SidebarProvider } from "@loyalty/ui";
import { setRequestLocale } from "next-intl/server";

import { AppSidebar } from "@/features/home/components/app-sidebar";
import { RedemptionHistory } from "@/features/rewards/components/redemption-history";
import { requireCustomer } from "@/lib/auth-guard";

type Props = { params: Promise<{ locale: string }> };

export default async function RewardsHistoryPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await requireCustomer();

  return (
    <SidebarProvider style={{ "--sidebar-width": "18rem" } as React.CSSProperties}>
      <AppSidebar />
      <SidebarInset className="from-primary/5 to-background text-foreground overflow-x-clip bg-gradient-to-b">
        <RedemptionHistory />
      </SidebarInset>
    </SidebarProvider>
  );
}

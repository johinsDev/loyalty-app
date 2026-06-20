import { STAFF_OR_ABOVE } from "@loyalty/auth/server";
import type { ReactNode } from "react";

import { CashierHeader } from "@/features/cashier/components/cashier-header";
import { CashierTabBar } from "@/features/cashier/components/cashier-tab-bar";
import { requireRole } from "@/lib/auth-guard";

/**
 * Shell for the whole cashier segment — role-gated once (staff+), full-screen
 * (no dashboard sidebar). A compact header on top, the active tab in the
 * middle, and the tab bar at the bottom. Each tab is its own route.
 */
export default async function CashierLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireRole(STAFF_OR_ABOVE);
  return (
    <div className="bg-muted/40 text-foreground flex h-screen flex-col overflow-hidden">
      <CashierHeader />
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>
      <CashierTabBar />
    </div>
  );
}

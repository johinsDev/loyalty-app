import { STAFF_OR_ABOVE } from "@loyalty/auth/server";
import { type ReactNode, Suspense } from "react";

import { CashierHeader } from "@/features/cashier/components/cashier-header";
import { CashierTabBar } from "@/features/cashier/components/cashier-tab-bar";
import { RoleGuard } from "@/features/shell/role-guard";

/**
 * Shell for the whole cashier segment — role-gated (staff+), full-screen (no
 * dashboard sidebar). A compact header on top, the active tab in the middle,
 * and the tab bar at the bottom. Each tab is its own route.
 *
 * The gate renders beside the chrome rather than wrapping it: the role check is
 * a session round-trip, and gating the whole shell on it left the register blank
 * on every open. Header and tab bar each keep a boundary of their own (they read
 * route params, which `cacheComponents` wants inside Suspense) but nothing
 * awaits in front of them any more; the inner boundary keeps them mounted while
 * a tab navigation resolves.
 */
export default function CashierLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-muted/40 text-foreground flex h-screen flex-col overflow-hidden">
      <Suspense fallback={null}>
        <RoleGuard allowed={STAFF_OR_ABOVE} />
      </Suspense>
      <Suspense fallback={null}>
        <CashierHeader />
      </Suspense>
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Suspense fallback={null}>{children}</Suspense>
      </main>
      <Suspense fallback={null}>
        <CashierTabBar />
      </Suspense>
    </div>
  );
}

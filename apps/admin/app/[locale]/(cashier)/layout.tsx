import { STAFF_OR_ABOVE } from "@loyalty/auth/server";
import { type ReactNode, Suspense } from "react";

import { CashierHeader } from "@/features/cashier/components/cashier-header";
import { CashierScope } from "@/features/cashier/components/cashier-scope";
import { CashierTabBar } from "@/features/cashier/components/cashier-tab-bar";
import { RoleGate } from "@/features/shell/role-gate";
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
 *
 * `cashier-scope` is where the segment's look is shielded from the admin's Luma
 * pills (see app/globals.css) — the shared vocabulary the tabs build on lives in
 * `features/cashier/components/chrome.tsx`.
 */
export default function CashierLayout({ children }: { children: ReactNode }) {
  return (
    <div className="cashier-scope bg-muted/40 text-foreground flex h-screen flex-col overflow-hidden">
      {/* Extends the scope to portalled dialogs/drawers, which hang off body. */}
      <CashierScope />
      <Suspense fallback={null}>
        <RoleGuard allowed={STAFF_OR_ABOVE} />
      </Suspense>
      {/* The header gates one affordance on the role (the way back to the
          dashboard), so it needs the provider. Same promise-not-await shape as
          the dashboard shell: nothing here waits on the session hop.
          The gate stays around the header ALONE on purpose — widening it to wrap
          `main` so Perfil could read `useRole()` broke every cashier route (the
          role promise crossing the RSC boundary above the page fails the
          cacheComponents runtime-data rule). Perfil reads its role from the
          session instead. */}
      <Suspense fallback={null}>
        <RoleGate>
          <CashierHeader />
        </RoleGate>
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

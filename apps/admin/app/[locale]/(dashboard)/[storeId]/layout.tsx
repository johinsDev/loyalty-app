import { type ReactNode, Suspense } from "react";

import { AdminShell } from "@/components/admin-shell";
import { GreetingSkeleton, NavSkeleton } from "@/components/admin-shell-skeleton";
import { ListPageSkeleton } from "@/components/data-table";
import { ImpersonationBanner } from "@/features/employees/components/impersonation-banner";
import { Greeting } from "@/features/shell/greeting";
import { NavData } from "@/features/shell/nav-data";
import { RoleGate } from "@/features/shell/role-gate";

/**
 * Store shell. A **static** frame ({@link AdminShell}) with each dynamic piece
 * streaming into its own hole: the role-gated nav, the name+counts greeting, the
 * store-scoped islands (switcher / cashier / mobile drawer, inside the frame), and
 * the page. Nothing here `await`s at the top, so the frame prerenders and the
 * pieces fill in independently — no "skeleton of everything" on reload. Store
 * scope is resolved client-side from the URL (`useStoreScope`); route protection
 * is per-page + the Worker (every procedure is role-gated). `RoleGate` provides
 * the role to the page subtree for client `useHasRole` gating.
 */
export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <AdminShell
      nav={
        <Suspense fallback={<NavSkeleton />}>
          <NavData />
        </Suspense>
      }
      greeting={
        <Suspense fallback={<GreetingSkeleton />}>
          <Greeting />
        </Suspense>
      }
    >
      <ImpersonationBanner />
      <Suspense fallback={<ListPageSkeleton />}>
        <RoleGate>{children}</RoleGate>
      </Suspense>
    </AdminShell>
  );
}

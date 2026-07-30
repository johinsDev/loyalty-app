import { type ReactNode, Suspense } from "react";

import { AdminShell } from "@/components/admin-shell";
import {
  GreetingSkeleton,
  NavSkeleton,
  PageSkeleton,
  ScopeIslandsSkeleton,
} from "@/components/admin-shell-skeleton";
import { ImpersonationBanner } from "@/features/employees/components/impersonation-banner";
import { Greeting } from "@/features/shell/greeting";
import { NavData } from "@/features/shell/nav-data";
import { RoleGate } from "@/features/shell/role-gate";
import { ScopeIslands } from "@/features/shell/scope-islands";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string; storeId: string }>;
};

/**
 * Store shell. A **static** frame ({@link AdminShell}) with each dynamic piece
 * streaming into its own hole: the role-gated nav, the name+counts greeting, the
 * store-scoped islands (switcher + cashier, seeded server-side), and the page.
 * Nothing here `await`s at the top — the `params` promise is passed down into the
 * `scopeIslands` hole, not awaited here — so the frame prerenders and the pieces
 * fill in independently, no "skeleton of everything" on reload. Store scope is
 * resolved client-side from the URL (`useStoreScope`, seeded via `ScopeIslands`);
 * route protection is per-page + the Worker. `RoleGate` provides the role to the
 * page subtree for client `useHasRole` gating.
 */
export default function StoreLayout({ children, params }: Props) {
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
      scopeIslands={
        <Suspense fallback={<ScopeIslandsSkeleton />}>
          <ScopeIslands params={params} />
        </Suspense>
      }
    >
      <ImpersonationBanner />
      {/* `RoleGate` no longer awaits (it passes the role down as a promise), so
          the page renders straight away; the Suspense here only covers whatever
          holes the page itself opens. */}
      <Suspense fallback={<PageSkeleton />}>
        <RoleGate>{children}</RoleGate>
      </Suspense>
    </AdminShell>
  );
}

import { MANAGER_OR_ABOVE, STAFF_OR_ABOVE } from "@loyalty/auth/server";
import { type ReactNode, Suspense } from "react";

import { AdminShell } from "@/components/admin-shell";
import { AdminShellSkeleton } from "@/components/admin-shell-skeleton";
import { ListPageSkeleton } from "@/components/data-table";
import { ImpersonationBanner } from "@/features/employees/components/impersonation-banner";
import { redirect } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth-guard";
import { StoreScopeProvider } from "@/lib/store-scope";
import { loadStoreScope } from "@/lib/store-scope-server";
import { trpc } from "@/lib/trpc/server";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string; storeId: string }>;
};

/**
 * Store-scoped shell. Resolves the `[storeId]` segment (`"all"` = aggregate, or
 * a real store id) against the org's live store list, bounces an unknown id to
 * `/all`, and provides the scope to the switcher + nav + views. Every admin CRM
 * page renders inside here.
 *
 * Under `cacheComponents` the whole shell is auth-gated + store-scoped (reads the
 * session cookie + the runtime `[storeId]` segment) so it can never be part of
 * the static prerender. It is rendered as **two** Suspense holes so the outer
 * chrome (root + `[locale]`) still prerenders: the OUTER boundary streams the
 * shell itself (role, scope, nav counts) on first load / store switch; the INNER
 * boundary streams the active page so navigating between pages keeps the sidebar
 * mounted instead of re-flashing the whole shell.
 */
export default function StoreLayout({ children, params }: Props) {
  return (
    <Suspense fallback={<AdminShellSkeleton />}>
      <StoreShell params={params}>{children}</StoreShell>
    </Suspense>
  );
}

async function StoreShell({ children, params }: Props) {
  const { locale, storeId } = await params;
  const { session, role } = await requireRole(STAFF_OR_ABOVE);
  const name = (session.user as { name?: string }).name?.trim() || "Equipo";

  const { stores, scope } = await loadStoreScope(storeId);
  if (!scope) {
    redirect({ href: { pathname: "/[storeId]/dashboard", params: { storeId: "all" } }, locale });
    return null;
  }

  // Prefetch the sidebar counters (manager+) so they paint with the HTML — the
  // shell's client query then hydrates from this instead of a fresh fetch.
  let navCounts: Awaited<
    ReturnType<Awaited<ReturnType<typeof trpc>>["dashboard"]["navCounts"]>
  > | undefined;
  if (MANAGER_OR_ABOVE.includes(role)) {
    try {
      const api = await trpc();
      navCounts = await api.dashboard.navCounts();
    } catch {
      navCounts = undefined;
    }
  }

  return (
    <StoreScopeProvider
      value={{ segment: storeId, storeId: scope.storeId, store: scope.store, stores }}
    >
      <AdminShell role={role} name={name} navCounts={navCounts}>
        <ImpersonationBanner />
        <Suspense fallback={<ListPageSkeleton />}>{children}</Suspense>
      </AdminShell>
    </StoreScopeProvider>
  );
}

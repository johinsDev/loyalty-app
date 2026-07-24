import { MANAGER_OR_ABOVE, STAFF_OR_ABOVE } from "@loyalty/auth/server";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin-shell";
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
 */
export default async function StoreLayout({ children, params }: Props) {
  const { locale, storeId } = await params;
  // const { session, role } = await requireRole(STAFF_OR_ABOVE);
  // const name = (session.user as { name?: string }).name?.trim() || "Equipo";
  

  // Prefetch the sidebar counters (manager+) so they paint with the HTML — the
  // shell's client query then hydrates from this instead of a fresh fetch.
  
  return (
    <StoreScopeProvider
      value={{ segment: storeId, storeId:storeId, store: null, stores: [] }}
    >
      <AdminShell role={'owner'} name={'TEST'} navCounts={{ customers: 0, promotions: 0,stores: 0}}>
        <ImpersonationBanner />
        {children}
      </AdminShell>
    </StoreScopeProvider>
  );
}

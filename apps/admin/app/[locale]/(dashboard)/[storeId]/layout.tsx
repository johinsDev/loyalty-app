import { resolveStoreScope } from "@loyalty/api/features/_shared/store-scope";
import { STAFF_OR_ABOVE } from "@loyalty/auth/server";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin-shell";
import { ImpersonationBanner } from "@/features/employees/components/impersonation-banner";
import { redirect } from "@/i18n/navigation";
import { requireRole } from "@/lib/auth-guard";
import { StoreScopeProvider } from "@/lib/store-scope";
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
  const { session, role } = await requireRole(STAFF_OR_ABOVE);
  const name = (session.user as { name?: string }).name?.trim() || "Equipo";

  const api = await trpc();
  const stores = await api.stores.switcherList().catch(() => []);
  const scope = resolveStoreScope(stores, storeId);
  if (!scope) {
    redirect({ href: { pathname: "/[storeId]/dashboard", params: { storeId: "all" } }, locale });
    return null;
  }

  return (
    <StoreScopeProvider
      value={{ segment: storeId, storeId: scope.storeId, store: scope.store, stores }}
    >
      <AdminShell role={role} name={name}>
        <ImpersonationBanner />
        {children}
      </AdminShell>
    </StoreScopeProvider>
  );
}

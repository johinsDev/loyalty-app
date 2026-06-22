import { STAFF_OR_ABOVE } from "@loyalty/auth/server";
import type { ReactNode } from "react";

import { AdminShell } from "@/components/admin-shell";
import { requireRole } from "@/lib/auth-guard";

type Props = { children: ReactNode };

/**
 * Shell for every admin CRM page: a fixed sidebar on desktop, a drawer on
 * tablet/mobile (AdminShell). Gates the route group once — staff/manager/owner
 * pass, customers get bounced — and resolves the role server-side.
 */
export default async function DashboardLayout({ children }: Props) {
  const { session, role } = await requireRole(STAFF_OR_ABOVE);
  const name = (session.user as { name?: string }).name?.trim() || "Equipo";

  return (
    <AdminShell role={role} name={name}>
      {children}
    </AdminShell>
  );
}

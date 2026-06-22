import { STAFF_OR_ABOVE } from "@loyalty/auth/server";
import { SidebarInset, SidebarProvider } from "@loyalty/ui";
import type { ReactNode } from "react";

import { AdminSidebar } from "@/components/admin-sidebar";
import { AdminTopbar } from "@/components/admin-topbar";
import { requireRole } from "@/lib/auth-guard";

type Props = { children: ReactNode };

/**
 * Shell for every admin CRM page: a collapsible sidebar (drawer on mobile) + a
 * top bar (store switcher, Cashier mode, notifications, user menu). Gates the
 * route group once — staff/manager/owner pass, customers get bounced — and
 * resolves the role server-side, handed to the client sidebar as a prop.
 */
export default async function DashboardLayout({ children }: Props) {
  const { session, role } = await requireRole(STAFF_OR_ABOVE);
  const name = (session.user as { name?: string }).name?.trim() || "Equipo";

  return (
    <SidebarProvider>
      <AdminSidebar role={role} />
      <SidebarInset className="bg-muted/30 flex min-h-screen flex-col">
        <AdminTopbar name={name} />
        <main className="flex-1">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

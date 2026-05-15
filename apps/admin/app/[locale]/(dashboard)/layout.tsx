import { STAFF_OR_ABOVE } from "@loyalty/auth/server";
import type { ReactNode } from "react";

import { DashboardNav } from "@/components/dashboard-nav";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { requireRole } from "@/lib/auth-guard";

type Props = { children: ReactNode };

/**
 * Shared shell for every admin dashboard page. Two responsibilities:
 *   1. Gate the route group — customers who somehow land on admin get
 *      bounced to /sign-in?error=forbidden. Staff / manager / owner
 *      all pass.
 *   2. Render the sidebar + sign-out + (for owners) a Dev tools link.
 *      The role is resolved once here, server-side, and handed to the
 *      client nav as a prop so the client doesn't refetch it.
 */
export default async function DashboardLayout({ children }: Props) {
  const { role } = await requireRole(STAFF_OR_ABOVE);

  return (
    <div className="grid min-h-screen grid-cols-[200px_1fr]">
      <aside className="flex flex-col border-r border-border bg-muted/30">
        <div className="px-4 pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Loyalty CRM
        </div>
        <DashboardNav role={role} />
        <div className="mt-auto p-4">
          <SignOutButton />
        </div>
      </aside>
      <div>{children}</div>
    </div>
  );
}

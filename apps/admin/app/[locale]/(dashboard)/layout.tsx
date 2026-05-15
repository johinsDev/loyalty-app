import type { ReactNode } from "react";

import { DashboardNav } from "@/components/dashboard-nav";
import { SignOutButton } from "@/features/auth/components/sign-out-button";

type Props = { children: ReactNode };

/**
 * Shared shell for every admin dashboard page. Renders the sidebar
 * nav once and slots the page content alongside, so each leaf page
 * stays as a thin wrapper around its Feature component.
 */
export default function DashboardLayout({ children }: Props) {
  return (
    <div className="grid min-h-screen grid-cols-[200px_1fr]">
      <aside className="flex flex-col border-r border-border bg-muted/30">
        <div className="px-4 pt-6 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Loyalty CRM
        </div>
        <DashboardNav />
        <div className="mt-auto p-4">
          <SignOutButton />
        </div>
      </aside>
      <div>{children}</div>
    </div>
  );
}

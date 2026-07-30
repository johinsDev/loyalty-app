import { MANAGER_OR_ABOVE } from "@loyalty/auth/server";
import { type ReactNode, Suspense } from "react";

import { RoleGuard } from "@/features/shell/role-guard";

/** Analytics are manager/owner only — staff who reach any `/analytics/*` URL
 *  directly are bounced (the sidebar already hides it). */
export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <RoleGuard allowed={MANAGER_OR_ABOVE} />
      </Suspense>
      {children}
    </>
  );
}

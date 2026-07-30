import { MANAGER_OR_ABOVE } from "@loyalty/auth/server";
import { type ReactNode, Suspense } from "react";

import { RoleGuard } from "@/features/shell/role-guard";

/** Catalog management is manager/owner only — staff who reach any `/products/*`
 *  URL directly are bounced (the sidebar already hides it). */
export default function ProductsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <RoleGuard allowed={MANAGER_OR_ABOVE} />
      </Suspense>
      {children}
    </>
  );
}

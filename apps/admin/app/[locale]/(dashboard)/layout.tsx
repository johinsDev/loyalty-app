import { STAFF_OR_ABOVE } from "@loyalty/auth/server";
import { type ReactNode, Suspense } from "react";

import { RoleGuard } from "@/features/shell/role-guard";

/**
 * Gate for the whole admin CRM route group: staff/manager/owner pass, customers
 * get bounced. The shell + store scope live one level down in
 * `[storeId]/layout.tsx` (which needs the store segment to resolve).
 *
 * The guard renders **beside** `children`, not around them: the role check reads
 * the session cookie (a Worker hop), and wrapping the page in it meant every
 * navigation waited on that hop before a single pixel of the page shell could
 * flush. As a sibling it redirects just the same, a beat later.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <RoleGuard allowed={STAFF_OR_ABOVE} />
      </Suspense>
      {/* `children` keeps a boundary of its own — the shell below reads route
          params (`useRouter`, the ⌘K palette), which `cacheComponents` requires
          to sit inside Suspense. It used to ride on the gate's boundary; what
          changed is that nothing *awaits* in front of it any more. */}
      <Suspense fallback={null}>{children}</Suspense>
    </>
  );
}

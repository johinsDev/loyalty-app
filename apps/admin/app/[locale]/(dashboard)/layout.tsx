import { STAFF_OR_ABOVE } from "@loyalty/auth/server";
import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth-guard";

/**
 * Gate for the whole admin CRM route group: staff/manager/owner pass, customers
 * get bounced. The shell + store scope live one level down in
 * `[storeId]/layout.tsx` (which needs the store segment to resolve).
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireRole(STAFF_OR_ABOVE);
  return children;
}

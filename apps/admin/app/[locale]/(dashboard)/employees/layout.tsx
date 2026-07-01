import { MANAGER_OR_ABOVE } from "@loyalty/auth/server";
import type { ReactNode } from "react";

import { requireRole } from "@/lib/auth-guard";

/** Employee management is manager/owner only — cashiers who reach any
 *  `/employees/*` URL directly are bounced (the sidebar already hides it). */
export default async function EmployeesLayout({ children }: { children: ReactNode }) {
  await requireRole(MANAGER_OR_ABOVE);
  return children;
}

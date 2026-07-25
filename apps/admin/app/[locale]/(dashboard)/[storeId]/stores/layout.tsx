import type { ReactNode } from "react";

import { requireManager } from "@/lib/auth-guard";

/** Store management is manager/owner only — staff who reach any `/stores/*`
 *  URL directly are bounced (the sidebar already hides it). */
export default async function StoresLayout({ children }: { children: ReactNode }) {
  await requireManager();
  return children;
}

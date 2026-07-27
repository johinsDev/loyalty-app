import type { ReactNode } from "react";

import { requireManager } from "@/lib/auth-guard";

/** Analytics are manager/owner only — staff who reach any `/analytics/*` URL
 *  directly are bounced (the sidebar already hides it). */
export default async function AnalyticsLayout({ children }: { children: ReactNode }) {
  await requireManager();
  return children;
}

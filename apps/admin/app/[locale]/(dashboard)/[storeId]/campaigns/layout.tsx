import type { ReactNode } from "react";

import { requireManager } from "@/lib/auth-guard";

/** Campaign sends are manager/owner only — staff who reach any `/campaigns/*`
 *  URL directly are bounced (the sidebar already hides it). */
export default async function CampaignsLayout({ children }: { children: ReactNode }) {
  await requireManager();
  return children;
}

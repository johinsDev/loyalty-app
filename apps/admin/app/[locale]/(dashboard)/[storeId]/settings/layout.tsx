import type { ReactNode } from "react";

import { requireManager } from "@/lib/auth-guard";

/** Settings are manager/owner only — staff who reach any `/settings/*` URL
 *  directly are bounced (the sidebar already hides it). */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  await requireManager();
  return children;
}

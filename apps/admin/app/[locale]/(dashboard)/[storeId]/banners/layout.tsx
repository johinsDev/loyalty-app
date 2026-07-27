import type { ReactNode } from "react";

import { requireManager } from "@/lib/auth-guard";

/** Banner management is manager/owner only — staff who reach any `/banners/*`
 *  URL directly are bounced (the sidebar already hides it). */
export default async function BannersLayout({ children }: { children: ReactNode }) {
  await requireManager();
  return children;
}

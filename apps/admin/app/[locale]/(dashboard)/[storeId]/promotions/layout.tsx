import type { ReactNode } from "react";

import { requireManager } from "@/lib/auth-guard";

/** Promotions are manager/owner only — staff who reach any `/promotions/*`
 *  URL directly are bounced (the sidebar already hides it). */
export default async function PromotionsLayout({ children }: { children: ReactNode }) {
  await requireManager();
  return children;
}

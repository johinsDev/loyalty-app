import type { ReactNode } from "react";

import { requireManager } from "@/lib/auth-guard";

/** Loyalty program configuration is manager/owner only — staff who reach any
 *  `/loyalty/*` URL directly are bounced (the sidebar already hides it). */
export default async function LoyaltyLayout({ children }: { children: ReactNode }) {
  await requireManager();
  return children;
}

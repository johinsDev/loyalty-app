import type { ReactNode } from "react";

import { requireManager } from "@/lib/auth-guard";

/** Rewards management is manager/owner only — staff who reach any `/rewards/*`
 *  URL directly are bounced (the sidebar already hides it). */
export default async function RewardsLayout({ children }: { children: ReactNode }) {
  await requireManager();
  return children;
}

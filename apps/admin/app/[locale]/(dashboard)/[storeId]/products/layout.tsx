import type { ReactNode } from "react";

import { requireManager } from "@/lib/auth-guard";

/** Catalog management is manager/owner only — staff who reach any `/products/*`
 *  URL directly are bounced (the sidebar already hides it). */
export default async function ProductsLayout({ children }: { children: ReactNode }) {
  await requireManager();
  return children;
}

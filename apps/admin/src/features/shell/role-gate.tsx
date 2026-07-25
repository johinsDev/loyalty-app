import type { ReactNode } from "react";

import { getMe } from "@/lib/auth-guard";
import { RoleProvider } from "@/lib/role-context";

/**
 * RSC hole that resolves the member role (session cookie → dynamic, in Suspense)
 * and provides it to the page subtree via {@link RoleProvider}, so client
 * components can gate owner/manager-only affordances (`useHasRole`) without the
 * role being threaded through the now-static shell frame. Deduped via `getMe`.
 */
export async function RoleGate({ children }: { children: ReactNode }) {
  const me = await getMe();
  return <RoleProvider role={me?.role ?? "staff"}>{children}</RoleProvider>;
}

import type { Role } from "@loyalty/auth/server";
import type { ReactNode } from "react";

import { getMe } from "@/lib/auth-guard";
import { RoleProvider } from "@/lib/role-context";

/** The member role for the shell. Deduped via `getMe`, so the sibling
 *  `RoleGuard` redirect check shares this one Worker hop. */
async function roleOf(): Promise<Role> {
  const me = await getMe();
  return me?.role ?? "staff";
}

/**
 * Provides the member role to the page subtree so client components can gate
 * owner/manager-only affordances (`useHasRole`).
 *
 * Hands the provider a **promise** instead of awaiting it: this wraps every
 * page, so awaiting made the session round-trip a hard gate on the whole
 * subtree — nothing painted until it came back. Nothing awaits here now, so
 * `children` render immediately and the role lands a beat later.
 */
export function RoleGate({ children }: { children: ReactNode }) {
  return <RoleProvider rolePromise={roleOf()}>{children}</RoleProvider>;
}

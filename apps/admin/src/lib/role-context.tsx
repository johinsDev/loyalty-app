"use client";

import type { Role } from "@loyalty/auth/server";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

/** The current member's role, provided once at the shell so any client
 *  component can gate owner/manager-only affordances without prop-drilling. */
const RoleContext = createContext<Role | null>(null);

/**
 * Takes the role as a **promise** so the shell never awaits it. Resolving it
 * server-side made this provider a parent of every page, which held the whole
 * subtree until the session round-trip returned; now the page streams right
 * away and the (few) role-gated affordances light up a beat later.
 */
export function RoleProvider({
  rolePromise,
  children,
}: {
  rolePromise: Promise<Role>;
  children: ReactNode;
}) {
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => {
    let active = true;
    void rolePromise.then((next) => {
      if (active) setRole(next);
    });
    return () => {
      active = false;
    };
  }, [rolePromise]);
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): Role | null {
  return useContext(RoleContext);
}

const RANK: Record<Role, number> = { customer: 0, staff: 1, manager: 2, owner: 3 };

/** True when the current role is at least `min` (customer < staff < manager < owner).
 *  False until the promise resolves — gate affordances with it, never data. */
export function useHasRole(min: Role): boolean {
  const role = useRole();
  return role != null && RANK[role] >= RANK[min];
}

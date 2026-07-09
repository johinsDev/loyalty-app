"use client";

import type { Role } from "@loyalty/auth/server";
import { createContext, type ReactNode, useContext } from "react";

/** The current member's role, provided once at the shell so any client
 *  component can gate owner/manager-only affordances without prop-drilling. */
const RoleContext = createContext<Role | null>(null);

export function RoleProvider({ role, children }: { role: Role; children: ReactNode }) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): Role | null {
  return useContext(RoleContext);
}

const RANK: Record<Role, number> = { customer: 0, staff: 1, manager: 2, owner: 3 };

/** True when the current role is at least `min` (customer < staff < manager < owner). */
export function useHasRole(min: Role): boolean {
  const role = useRole();
  return role != null && RANK[role] >= RANK[min];
}

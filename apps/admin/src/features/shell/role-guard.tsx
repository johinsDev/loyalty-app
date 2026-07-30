import type { Role } from "@loyalty/auth/server";

import { requireRole } from "@/lib/auth-guard";

/**
 * Route gate that renders **beside** the page instead of wrapping it.
 *
 * The old shape — `async Layout() { await requireRole(); return children }` —
 * made the role check a parent of the page, so nothing (not even the static
 * header/toolbar shell the list pages are built around) could flush until the
 * session resolved: every navigation froze on one Worker hop. Mounted as a
 * sibling inside its own `<Suspense>`, the shell streams immediately and the
 * guard redirects when it resolves. Rendering nothing on success is the point.
 *
 * Not a security boundary on its own — every tRPC procedure enforces the role
 * on the Worker, so an unauthorized user can render an empty shell for a beat
 * but can never read data.
 */
export async function RoleGuard({ allowed }: { allowed: readonly Role[] }) {
  await requireRole(allowed);
  return null;
}

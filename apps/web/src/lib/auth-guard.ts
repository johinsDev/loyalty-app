import "server-only";

import { auth, getUserRole, type Role } from "@loyalty/auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Server Component / layout / page.tsx auth helpers.
 *
 * Pattern recommended by Better Auth's Next.js doc:
 *   const session = await auth.api.getSession({ headers: await headers() });
 *   if (!session) redirect("/sign-in");
 *
 * Wrapped here so every page that needs a session writes one line.
 * Mirror copy lives in apps/admin — same logic, different default
 * redirect target if you tune it per app.
 */

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  return session;
}

export async function requireRole(allowed: readonly Role[]) {
  const session = await requireSession();
  const role = await getUserRole(session.user.id);
  if (!allowed.includes(role)) redirect("/sign-in?error=forbidden");
  return { session, role };
}

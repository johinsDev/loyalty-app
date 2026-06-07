import "server-only";

import { auth, getUserRole, type Role } from "@loyalty/auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { trpc } from "./trpc/server";

/**
 * Server Component / layout / page.tsx auth helpers.
 *
 * Cutover switch: when `NEXT_PUBLIC_API_URL` is set, the session + role are
 * resolved through the Worker (`auth.me`, forwarding the cookie via the RSC tRPC
 * caller) — the FE no longer reads the DB or runs Better Auth. Unset → the
 * in-process path (local better-auth + `getUserRole`), unchanged, so prod is
 * untouched until the flip. See the api-worker cutover. Mirror copy in apps/admin.
 */
const viaWorker = !!process.env.NEXT_PUBLIC_API_URL;

export async function requireSession() {
  if (viaWorker) {
    const me = await (await trpc()).auth.me().catch(() => null);
    if (!me?.user) redirect("/sign-in");
    return { user: me.user };
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  return session;
}

/**
 * Like `requireSession`, but also requires the user to be a loyalty `customer`
 * (`me.isCustomer`, set when they verify a phone). Phone is the loyalty
 * identity, so a Google sign-in with no phone yet is sent to `/complete-phone`
 * to capture + verify it (which links the phone + provisions the customer). Use
 * on every authenticated customer page — the proxy already guarantees a session
 * cookie, so this only adds the customer gate.
 *
 * Gates on the `customer` row (authoritative), NOT the session user's
 * `phoneNumber` field — that field isn't reliably surfaced by `auth.me`, which
 * would loop a real customer back to `/complete-phone`.
 */
export async function requireCustomer() {
  const me = await (await trpc()).auth.me().catch(() => null);
  if (!me?.user) redirect("/sign-in");
  if (!me.isCustomer) redirect("/complete-phone");
  return { user: me.user };
}

export async function requireRole(allowed: readonly Role[]) {
  if (viaWorker) {
    const me = await (await trpc()).auth.me().catch(() => null);
    if (!me?.user) redirect("/sign-in");
    if (!allowed.includes(me.role)) redirect("/sign-in?error=forbidden");
    return { session: { user: me.user }, role: me.role };
  }
  const session = await requireSession();
  const role = await getUserRole(session.user.id);
  if (!allowed.includes(role)) redirect("/sign-in?error=forbidden");
  return { session, role };
}

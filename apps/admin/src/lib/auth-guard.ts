import "server-only";

import {
  auth,
  getUserRole,
  MANAGER_OR_ABOVE,
  type Role,
  STAFF_OR_ABOVE,
} from "@loyalty/auth/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { isSignedOut, trpcErrorData } from "./trpc-errors";
import { log } from "./log";
import { trpc } from "./trpc/server";

/**
 * Server Component / layout / page.tsx auth helpers.
 *
 * Cutover switch: when `NEXT_PUBLIC_API_URL` is set, the session + role are
 * resolved through the Worker (`auth.me`, forwarding the cookie via the RSC tRPC
 * caller) — the FE no longer reads the DB or runs Better Auth. Unset → the
 * in-process path (local better-auth + `getUserRole`), unchanged, so prod is
 * untouched until the flip. See the api-worker cutover. Mirror copy in apps/web.
 */
const viaWorker = !!process.env.NEXT_PUBLIC_API_URL;

type SessionUser = { id: string; name?: string | null };

/**
 * Ask the Worker who this is.
 *
 * Only `UNAUTHORIZED` means "signed out". Everything else — a 429 from the rate
 * limiter, a 5xx, a cookie the Worker rejected, a network blip — is an outage,
 * and it must NOT be reported as a missing session: the guards below turn `null`
 * into `redirect("/sign-in")`, so swallowing every error here logs the user out
 * on a server fault and leaves no trace anywhere. That is exactly what made the
 * preview "logs in, bounces straight back to sign-in" impossible to diagnose.
 *
 * So: log it (with the tRPC code + HTTP status, which is the bit you actually
 * need) and rethrow. An error boundary that Sentry captures beats a silent
 * logout loop.
 */
async function fetchMe() {
  try {
    return await (await trpc()).auth.me();
  } catch (err) {
    if (isSignedOut(err)) return null;
    const data = trpcErrorData(err);
    log.error(
      { err, code: data?.code, httpStatus: data?.httpStatus },
      "authGuard.me.failed — NOT signed out; the Worker call failed",
    );
    throw err;
  }
}

/**
 * Session + role for the current request, resolved **once** and deduped via
 * React `cache()`. The layout chain (`(dashboard)` → `[storeId]`, +`employees`)
 * and pages all gate through this, so what used to be 2–3 independent `auth.me()`
 * Worker hops collapse to a single call per request. Returns `null` signed out.
 */
export const getMe = cache(
  async (): Promise<{ user: SessionUser; role: Role } | null> => {
    if (viaWorker) {
      const me = await fetchMe();
      return me?.user ? { user: me.user, role: me.role } : null;
    }
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return null;
    const role = await getUserRole(session.user.id);
    return { user: session.user, role };
  },
);

export async function requireSession() {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  return { user: me.user };
}

/**
 * Non-redirecting session lookup — returns `null` when signed out (vs
 * `requireSession`, which redirects). For pages that render for both signed-in
 * and signed-out users.
 */
export async function getSession(): Promise<{ user: { id: string } } | null> {
  const me = await getMe();
  return me ? { user: me.user } : null;
}

export async function requireRole(allowed: readonly Role[]) {
  const me = await getMe();
  if (!me) redirect("/sign-in");
  if (!allowed.includes(me.role)) redirect("/sign-in?error=forbidden");
  return { session: { user: me.user }, role: me.role };
}

export const requireStaff = () => requireRole(STAFF_OR_ABOVE);
export const requireManager = () => requireRole(MANAGER_OR_ABOVE);

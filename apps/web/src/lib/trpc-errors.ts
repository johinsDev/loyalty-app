// Standalone export, NOT a static on `TRPCClientError` in @trpc/client v11 —
// `TRPCClientError.isTRPCClientError(...)` throws "not a function" at runtime,
// which inside a catch block would mask the very error being inspected.
import { isTRPCClientError } from "@trpc/client";

/** The bits of a tRPC error shape the guards care about. */
export type TrpcErrorData = { code?: string; httpStatus?: number };

export function trpcErrorData(err: unknown): TrpcErrorData | undefined {
  if (!isTRPCClientError(err)) return undefined;
  return (err.data ?? undefined) as TrpcErrorData | undefined;
}

/**
 * Is this the Worker telling us the visitor is signed out — as opposed to the
 * Worker being unreachable, rate-limiting us, or throwing?
 *
 * Deliberately narrow. Everything this returns `false` for gets logged and
 * rethrown by the guards; everything it returns `true` for silently redirects
 * to `/sign-in`. Widening it re-introduces the silent-logout class of bug.
 *
 * No `server-only` import here (unlike `auth-guard.ts`) so it stays testable.
 * Mirror copy in apps/admin.
 */
export function isSignedOut(err: unknown): boolean {
  const data = trpcErrorData(err);
  if (!data) return false;
  return data.code === "UNAUTHORIZED" || data.httpStatus === 401;
}

/**
 * Cookie **names** in a `Cookie` header, in order. Never the values — every one
 * of them is a bearer credential.
 *
 * "Some cookie was sent" is not enough to diagnose a 401: a header carrying only
 * Vercel's `_vercel_jwt` looks identical to one carrying a session. The names
 * say whether the Better Auth session cookie was actually there.
 *
 * Values may contain `=` (base64 padding on a JWT), so split on the first one.
 */
export function cookieNames(cookie: string): string[] {
  return cookie
    .split(";")
    .map((pair) => pair.split("=", 1)[0]?.trim() ?? "")
    .filter(Boolean);
}

import "server-only";

import type { AppRouter, appRouter } from "@loyalty/api";
import { PROCEDURE_TYPES } from "@loyalty/api/procedure-types";
import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";
import { headers } from "next/headers";
import superjson from "superjson";

import { log } from "../log";
import { cookieNames, trpcErrorData } from "../trpc-errors";
import { getTrpcUrl } from "./shared";

type ServerCaller = ReturnType<typeof appRouter.createCaller>;

// Procedure path ("smsOutbox.list") → "query" | "mutation", so the HTTP proxy below
// can dispatch to .query / .mutation. Read from the GENERATED literal, never
// from `appRouter` itself: a value import of the router would pull the whole
// backend (better-auth, drizzle, the DB client) into this serverless function.
// `packages/api` has a test that fails if the literal drifts from the router.
const procedureTypes = new Map(Object.entries(PROCEDURE_TYPES));

// Property probes JS/serialization runtimes fire on the caller proxy (awaiting
// checks `.then`; JSON/string coercion check `.toJSON`/`.toString`/`.valueOf`).
// None are procedures — answering them with a nested proxy makes the runtime
// call tRPC at a bogus path (e.g. `toJSON` → 404).
const NON_PROCEDURE_KEYS = new Set([
  "then",
  "catch",
  "finally",
  "toJSON",
  "toString",
  "valueOf",
]);

/**
 * Caller-shaped proxy (`api.foo.bar(input)`) backed by an HTTP tRPC client, so
 * the call-sites are byte-for-byte the same as the in-process caller. The
 * **untyped** client takes the dotted procedure path directly — no traversal of
 * the typed proxy (which returns nested proxies, not callable leaves). Each call
 * dispatches to `.query` / `.mutation` by the procedure type. The incoming
 * session cookie is forwarded so the Worker authenticates the request the same
 * way Better Auth would in-process.
 */
const httpCaller = (cookie: string): ServerCaller => {
  const client = createTRPCUntypedClient<AppRouter>({
    links: [
      httpBatchLink({
        url: getTrpcUrl(),
        transformer: superjson,
        headers: () => (cookie ? { cookie } : {}),
        // Never let Next cache a server-side auth/data read — a cached `auth.me`
        // would make guards (session/role) act on stale state.
        fetch: (input, init) =>
          fetch(input, { ...init, cache: "no-store" }),
      }),
    ],
  });

  const build = (path: string[]): unknown =>
    new Proxy(() => undefined, {
      // See NON_PROCEDURE_KEYS: don't answer serialization/thenable probes with
      // a nested proxy (that would dispatch a bogus tRPC call on JSON/await).
      get: (_target, key) =>
        typeof key === "string" && !NON_PROCEDURE_KEYS.has(key)
          ? build([...path, key])
          : undefined,
      apply: (_target, _thisArg, args) => {
        const procedure = path.join(".");
        const kind = procedureTypes.get(procedure);
        // Only dispatch for a path that is a real procedure — a stray call on a
        // non-procedure path (serialization edge cases) resolves to undefined
        // instead of hitting the Worker at a 404 path.
        if (!kind) return undefined;
        const call =
          kind === "mutation"
            ? client.mutation(procedure, args[0])
            : client.query(procedure, args[0]);
        // A 401 has two very different causes and they are indistinguishable
        // from the outside: either this render had no request cookies at all
        // (a prerendered / cached path — `headers()` gives nothing, so the call
        // goes out anonymous and the Worker is right to reject it), or we did
        // send a cookie and the Worker rejected it (session store, cookie
        // domain, an expired cookieCache). `hadCookie` is that one bit.
        // Length only — never the contents, it's a session token.
        return call.catch((err: unknown) => {
          if (trpcErrorData(err)?.httpStatus === 401) {
            log.warn(
              { procedure, hadCookie: cookie.length > 0, cookieBytes: cookie.length, cookies: cookieNames(cookie), },
              "trpcServer.unauthorized — Worker returned 401 for an RSC call",
            );
          }
          throw err;
        });
      },
    });

  return build([]) as ServerCaller;
};

/**
 * Server-side tRPC caller for RSC + route handlers.
 *
 * Always goes over HTTP to the standalone Worker (`api.t4diverclub.app`),
 * forwarding the request's session cookie so the Worker authenticates the
 * request the same way Better Auth would. The FE is a thin client — there is
 * no in-process backend path.
 */
export const trpc = async (): Promise<ServerCaller> => {
  const requestHeaders = await headers();
  return httpCaller(requestHeaders.get("cookie") ?? "");
};

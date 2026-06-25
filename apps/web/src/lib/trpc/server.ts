import "server-only";

import { type AppRouter, appRouter } from "@loyalty/api";
import { createTRPCUntypedClient, httpBatchLink } from "@trpc/client";
import { headers } from "next/headers";
import superjson from "superjson";

import { getTrpcUrl } from "./shared";

type ServerCaller = ReturnType<typeof appRouter.createCaller>;

// Procedure path ("clientes.list") → "query" | "mutation", read once from the
// router so the HTTP proxy below can dispatch to .query / .mutation.
const procedureTypes = new Map(
  Object.entries(
    (
      appRouter as unknown as {
        _def: { procedures: Record<string, { _def: { type: string } }> };
      }
    )._def.procedures,
  ).map(([path, proc]) => [path, proc._def.type]),
);

/**
 * Caller-shaped proxy (`api.foo.bar(input)`) backed by an HTTP tRPC client, so
 * the call-sites are byte-for-byte the same as the in-process caller. The
 * **untyped** client takes the dotted procedure path directly — no traversal of
 * the typed proxy (which returns nested proxies, not callable leaves). Each call
 * dispatches to `.query` / `.mutation` by the procedure type. The incoming
 * session cookie is forwarded so the Worker authenticates the request the same
 * way Better Auth would in-process.
 */
const httpCaller = (cookie: string, extra: Record<string, string>): ServerCaller => {
  const client = createTRPCUntypedClient<AppRouter>({
    links: [
      httpBatchLink({
        url: getTrpcUrl(),
        transformer: superjson,
        headers: () => ({ ...(cookie ? { cookie } : {}), ...extra }),
        // Never let Next cache a server-side auth/data read — a cached `auth.me`
        // would make guards (session/role/customer) act on stale state.
        fetch: (input, init) =>
          fetch(input, { ...init, cache: "no-store" }),
      }),
    ],
  });

  const build = (path: string[]): unknown =>
    new Proxy(() => undefined, {
      // `await trpc()` returns this proxy from an async fn, so the runtime
      // probes `.then` to test for a thenable. It must NOT answer then/catch/
      // finally with a procedure, or awaiting it calls tRPC at path "then" →
      // 404 ("No procedure found on path then"). No real procedure is named that.
      get: (_target, key) =>
        typeof key === "string" &&
        key !== "then" &&
        key !== "catch" &&
        key !== "finally"
          ? build([...path, key])
          : undefined,
      apply: (_target, _thisArg, args) => {
        const procedure = path.join(".");
        return procedureTypes.get(procedure) === "mutation"
          ? client.mutation(procedure, args[0])
          : client.query(procedure, args[0]);
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
export const trpc = async (opts?: { locale?: string }): Promise<ServerCaller> => {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get("cookie") ?? "";
  const fromCookie = (name: string) =>
    cookie
      .split("; ")
      .find((c) => c.startsWith(`${name}=`))
      ?.split("=")[1];
  const extra: Record<string, string> = {};
  const locale = opts?.locale ?? fromCookie("NEXT_LOCALE");
  const currency = fromCookie("NEXT_CURRENCY");
  if (locale) extra["x-locale"] = decodeURIComponent(locale);
  if (currency) extra["x-currency"] = decodeURIComponent(currency);
  return httpCaller(cookie, extra);
};

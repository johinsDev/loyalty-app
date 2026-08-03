"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useTRPC } from "@/lib/trpc/client";

/**
 * What a failing query actually does to the UI.
 *
 * The admin shipped error branches nobody could confirm ever run, because the
 * only way to see one was to hit a real bug — and by then the question was "why
 * is this screen wrong" instead of "does an error reach the UI at all".
 *
 * Both queries fire on mount, in the SAME batch (that is how the apps talk to
 * the API), one healthy and one that throws. `keepPreviousData` is on the
 * failing one because that is what the register uses, and it is what turns a
 * failure into believable stale data rather than an empty screen.
 */
export function QueryErrorSmoke() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // Reaching the cache from the console is the only way to see WHY a query is
  // stuck: `fetchStatus` alone doesn't say who stopped it.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__qc = queryClient;
  }, [queryClient]);

  const ok = useQuery(trpc.health.ping.queryOptions());
  const retried = useQuery(
    trpc.health.boom.queryOptions("uncaught", { placeholderData: keepPreviousData }),
  );
  const noRetry = useQuery(
    trpc.health.boom.queryOptions("trpc", {
      retry: false,
      placeholderData: keepPreviousData,
    }),
  );

  const row = (label: string, q: typeof ok | typeof retried) => (
    <tr className="border-border border-b" data-row={label}>
      <td className="py-2 pr-4 font-bold">{label}</td>
      <td className="py-2 pr-4 font-mono text-xs">{String(q.isPending)}</td>
      <td className="py-2 pr-4 font-mono text-xs">{String(q.isError)}</td>
      <td className="py-2 pr-4 font-mono text-xs">{q.fetchStatus}</td>
      <td className="py-2 font-mono text-xs">
        {q.error instanceof Error ? q.error.message.slice(0, 32) : "—"}
      </td>
    </tr>
  );

  return (
    <div className="mx-auto max-w-3xl p-6" data-testid="query-error-smoke">
      <h1 className="font-display mb-1 text-2xl font-bold">Errores de query</h1>
      <p className="text-muted-foreground mb-5 text-sm">
        Una query sana y dos que fallan, en el mismo batch. Si <code>isError</code> no pasa a true,
        ninguna pantalla del admin puede mostrar un error.
      </p>

      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground text-xs uppercase">
          <tr>
            <th className="pb-2">query</th>
            <th className="pb-2">isPending</th>
            <th className="pb-2">isError</th>
            <th className="pb-2">fetchStatus</th>
            <th className="pb-2">error</th>
          </tr>
        </thead>
        <tbody>
          {row("ping", ok)}
          {row("boom-retry", retried)}
          {row("boom-noretry", noRetry)}
        </tbody>
      </table>

      <p className="text-muted-foreground mt-5 text-xs">
        <code>boom-retry</code> usa el default de reintentos, como la caja.{" "}
        <code>boom-noretry</code> no reintenta. La diferencia entre las dos es cuánto tiempo un
        fallo se ve igual que un éxito.
      </p>
    </div>
  );
}

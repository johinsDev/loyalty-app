"use client";

import { focusManager, keepPreviousData, onlineManager, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useTRPC } from "@/lib/trpc/client";

/**
 * What a failing query actually does to the UI.
 *
 * The admin shipped error branches nobody could confirm ever run, because the
 * only way to see one was to hit a real bug — and by then the question was "why
 * is this screen wrong" instead of "does an error reach the UI at all".
 *
 * It also answers the question that made this page necessary: why a failing
 * query sometimes seems to hang forever. It isn't the batch link and it isn't
 * the app — React Query pauses retries while the tab is hidden
 * (`focusManager.isFocused()` gates `canContinue()` in the retryer), so a
 * failure sits at `fetchStatus: "paused"` with `isPending` true until the tab
 * comes back. `window.__focus.setFocused(true)` from the console resumes it and
 * the failure count climbs immediately — which is how that was pinned down, and
 * why every earlier measurement taken from an automated background tab read as
 * "never settles".
 *
 * Keep that in mind when reading this table: measure it with the tab in front
 * of you, or you are measuring the pause.
 */
export function QueryErrorSmoke() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // Reaching the cache from the console is the only way to see WHY a query is
  // stuck: `fetchStatus` alone doesn't say who stopped it.
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__qc = queryClient;
    (window as unknown as Record<string, unknown>).__online = onlineManager;
    (window as unknown as Record<string, unknown>).__focus = focusManager;
  }, [queryClient]);

  // The two knobs the register has that a plain query doesn't.
  const [armed, setArmed] = useState(true);
  const [nonce, setNonce] = useState(0);

  const ok = useQuery(trpc.health.ping.queryOptions());

  // A — plain: always enabled, stable key. The control.
  const plain = useQuery(trpc.health.boom.queryOptions("uncaught"));

  // B — `enabled`, the way the register gates on `cart.length > 0`.
  const gated = useQuery(trpc.health.boom.queryOptions("trpc", { enabled: armed }));

  // C — a key that changes, the way editing the cart re-keys the preview.
  const churning = useQuery(trpc.health.boom.queryOptions(nonce % 2 === 0 ? "uncaught" : "trpc"));

  // D — all of it at once: the register's exact shape.
  const registerShaped = useQuery(
    trpc.health.boom.queryOptions(nonce % 2 === 0 ? "trpc" : "uncaught", {
      enabled: armed,
      placeholderData: keepPreviousData,
    }),
  );

  const row = (label: string, q: typeof ok) => (
    <tr className="border-border border-b" data-row={label}>
      <td className="py-2 pr-4 font-bold">{label}</td>
      <td className="py-2 pr-4 font-mono text-xs">{String(q.isPending)}</td>
      <td className="py-2 pr-4 font-mono text-xs">{String(q.isError)}</td>
      <td className="py-2 pr-4 font-mono text-xs">{q.fetchStatus}</td>
      <td className="py-2 pr-4 font-mono text-xs">{q.failureCount}</td>
      <td className="py-2 font-mono text-xs">
        {q.error instanceof Error ? q.error.message.slice(0, 24) : "—"}
      </td>
    </tr>
  );

  return (
    <div className="mx-auto max-w-3xl p-6" data-testid="query-error-smoke">
      <h1 className="font-display mb-1 text-2xl font-bold">Errores de query</h1>
      <p className="text-muted-foreground mb-5 text-sm">
        Una query sana y cuatro que fallan, en el mismo batch. Si <code>isError</code> no pasa a
        true, ninguna pantalla puede mostrar un error.
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setArmed((a) => !a)}
          className="border-border rounded-lg border px-3 py-1.5 text-sm font-bold"
        >
          enabled: {String(armed)}
        </button>
        <button
          type="button"
          onClick={() => setNonce((n) => n + 1)}
          className="bg-primary rounded-lg px-3 py-1.5 text-sm font-bold text-white"
        >
          cambiar la key ({nonce})
        </button>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground text-xs uppercase">
          <tr>
            <th className="pb-2">query</th>
            <th className="pb-2">isPending</th>
            <th className="pb-2">isError</th>
            <th className="pb-2">fetchStatus</th>
            <th className="pb-2">fails</th>
            <th className="pb-2">error</th>
          </tr>
        </thead>
        <tbody>
          {row("ping", ok)}
          {row("A plain", plain)}
          {row("B enabled", gated)}
          {row("C key-churn", churning)}
          {row("D register-shaped", registerShaped)}
        </tbody>
      </table>

      <p className="text-muted-foreground mt-5 text-xs">
        A es el control: debería llegar a <code>isError</code>. La que no llegue señala cuál de las
        diferencias con la caja es la culpable.
      </p>
    </div>
  );
}

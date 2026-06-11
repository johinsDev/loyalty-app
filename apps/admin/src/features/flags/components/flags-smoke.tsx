"use client";

import {
  useFeatureFlag,
  useFlagsLoaded,
  useIsFeatureEnabled,
} from "@loyalty/feature-flags/react";
import { Button } from "@loyalty/ui";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/lib/trpc/client";

/**
 * Dev smoke for the feature-flags / A-B pipeline. Renders the SAME two
 * flags evaluated two ways:
 *   • client — `posthog-js` in the browser, via the `FlagsProvider` hooks.
 *   • server — `ctx.flags` in the Worker (`flags.smoke` tRPC procedure).
 * When PostHog is wired (key present) both columns should agree for a
 * stable `distinctId`; with no key both fall to the provider `null`
 * defaults. Flip a flag's rollout/variant in the PostHog UI, hit Reload,
 * and watch both sides move without a redeploy.
 */
export function FlagsSmoke() {
  const trpc = useTRPC();
  const server = useQuery(trpc.flags.smoke.queryOptions());

  // Client-side evaluation (posthog-js, cached in the browser).
  const clientEnabled = useIsFeatureEnabled("flags-smoke", false);
  const clientVariant = useFeatureFlag("flags-smoke-ab", "control");
  const clientLoaded = useFlagsLoaded();

  // The browser only ever talks to PostHog when the public key is present.
  const clientProvider = process.env.NEXT_PUBLIC_POSTHOG_KEY
    ? "posthog"
    : "null";

  const enabledMatch =
    server.data !== undefined && server.data.enabled === clientEnabled;
  const variantMatch =
    server.data !== undefined && server.data.variant === clientVariant;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <header className="space-y-1">
        <h1 className="font-semibold text-2xl">Feature flags — smoke</h1>
        <p className="text-muted-foreground text-sm">
          Server (<code>ctx.flags</code>, evaluated in the Worker) vs client (
          <code>posthog-js</code>, evaluated in the browser). They should agree
          when PostHog is wired and the <code>distinctId</code> is stable.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-4">
        <Column
          title="Server"
          provider={server.data?.provider}
          loaded={!server.isLoading}
          flagSmoke={server.data?.enabled}
          flagAb={server.data?.variant}
        />
        <Column
          title="Client"
          provider={clientProvider}
          loaded={clientLoaded}
          flagSmoke={clientEnabled}
          flagAb={clientVariant}
        />
      </div>

      <div className="space-y-2 rounded-lg border p-4 text-sm">
        <Row label="flags-smoke (boolean) match" ok={enabledMatch} />
        <Row label="flags-smoke-ab (variant) match" ok={variantMatch} />
      </div>

      <Button
        variant="outline"
        onClick={() => {
          void server.refetch();
        }}
        disabled={server.isFetching}
      >
        {server.isFetching ? "Reloading…" : "Reload server eval"}
      </Button>
    </div>
  );
}

function Column({
  title,
  provider,
  loaded,
  flagSmoke,
  flagAb,
}: {
  title: string;
  provider: string | undefined;
  loaded: boolean;
  flagSmoke: boolean | undefined;
  flagAb: string | boolean | undefined;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            provider === "posthog"
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          {provider ?? "…"}
        </span>
      </div>
      <dl className="space-y-1 text-sm">
        <Field
          label="flags-smoke"
          value={flagSmoke === undefined ? "…" : String(flagSmoke)}
        />
        <Field label="flags-smoke-ab" value={String(flagAb ?? "…")} />
        <Field label="flags loaded" value={String(loaded)} />
      </dl>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono">{value}</dd>
    </div>
  );
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className={ok ? "text-emerald-600" : "text-amber-600"}>
        {ok ? "✓ match" : "✗ differ"}
      </span>
    </div>
  );
}

---
name: trpc-perf
description: Per-procedure performance tracking for the loyalty-app tRPC API. A `withTiming` middleware times every procedure and ships a structured perf record (path, type, durationMs, ok, code, userId) through `@loyalty/log` → Better Stack. Use when reading endpoint latency, adding a perf alert, tuning the slow threshold, timing a raw (non-tRPC) handler, or debugging "no perf logs in Better Stack".
---

# trpc-perf — per-procedure timing → Better Stack

Every tRPC procedure is timed automatically and emits **one structured log
record per call**. Because `@loyalty/log` already routes to Better Stack in
preview/prod, those records become queryable perf data — no extra sink, no
APM vendor. This is deliberately *basic*: a duration + a few fields per call,
not spans/traces.

```
packages/api/src/trpc.ts
├── LoggerBinding            structural slice of @loyalty/log's Logger (info/warn/error)
├── ctx.log?: LoggerBinding  bound by each app; optional → fails open (CLI/tests)
├── withTiming               middleware: times the call, emits the perf record
└── baseProcedure            = t.procedure.use(withTiming).use(withBaseline)

apps/{web,admin}/src/lib/log.ts          the bootstrapped logger (channel by env)
apps/{web,admin}/src/lib/trpc/server.ts  RSC caller — binds `log` onto ctx
apps/{web,admin}/app/api/trpc/[trpc]/route.ts  fetch handler — binds `log` onto ctx
```

---

## How it works

`withTiming` is the **outermost** middleware on `baseProcedure`, so the measured
duration covers the baseline rate-limit, auth/role lookups *and* the resolver —
and a throttled `429` is still recorded. It reads `path`/`type` from the
middleware params, awaits `next()`, then logs:

```ts
const fields = {
  event: "trpc.request",   // filter perf logs apart from everything else
  path,                    // "sellos.add"
  type,                    // "query" | "mutation" | "subscription"
  durationMs,              // Math.round(performance.now() - start)
  ok,                      // false on a thrown TRPCError
  code,                    // present only when !ok, e.g. "TOO_MANY_REQUESTS"
  userId,                  // present only when authenticated
};
```

Level encodes severity so an alert can key off it:
- **error** — the procedure threw (any `TRPCError`).
- **warn** — succeeded but `durationMs >= SLOW_MS` (500ms).
- **info** — succeeded under the threshold.

Nothing is logged when `ctx.log` is unbound (CLI scripts, tests) — it fails
open exactly like the rate-limiter binding.

---

## Common tasks

### Tune the slow threshold
Edit `SLOW_MS` in `packages/api/src/trpc.ts`. It only changes which calls get
bumped to `warn`; every call is still logged with its `durationMs`.

### Query / alert in Better Stack
The dashboard **`loyalty: api perf`** (Better Stack → Telemetry → Dashboards,
team `Loyalty app`) is already wired to the `loyalty-web` source. See the
"Better Stack dashboard" section below for what's live and how to extend it.

### Time a raw (non-tRPC) handler
The middleware only covers tRPC. For a Next route handler, time it by hand with
the same shape so it lands in the same Better Stack view:

```ts
import { log } from "@/lib/log";

export async function POST(req: Request) {
  const start = performance.now();
  try {
    const res = await doWork(req);
    log.info({ event: "http.request", path: "/api/foo", durationMs: Math.round(performance.now() - start), ok: true });
    return res;
  } catch (err) {
    log.error({ event: "http.request", path: "/api/foo", durationMs: Math.round(performance.now() - start), ok: false, err });
    throw err;
  }
}
```

### Ad-hoc timing inside a resolver
`ctx.log` is the request logger — use it for sub-step timings:
`ctx.log?.info({ event: "trpc.step", step: "db.query", durationMs })`.

---

## Gotchas

- **No logger bound → no records.** If perf logs are missing locally, that's
  expected unless your `LOG_CHANNEL`/Better Stack token is set. The binding is
  passed in all four context factories; a *new* app must pass `log` too.
- **`durationMs` is wall-clock**, including serial awaits inside the resolver
  (DB, rate-limit, auth). That's the point — it's request latency, not CPU time.
- **`LoggerBinding` is a structural slice**, not an import of `Logger`, so
  `packages/api` stays free of a `@loyalty/log` dependency. Any object with
  `info/warn/error(fields, msg?)` satisfies it (e.g. `FakeLogger` in tests).
- **Volume.** One record per call. In a high-traffic SaaS phase, sample or drop
  `info` (keep `warn`/`error`) via the logger's `minLevel` rather than removing
  the middleware.

---

## Better Stack dashboard

Dashboard **`loyalty: api perf`** (group `loyalty`, source `loyalty-web` =
`2423294`) holds the live perf views. Operate it through the `better-stack`
skill's Telemetry MCP (`mcp__better-stack-telemetry__*`).

### What's live (works today, no setup)
Dashboard charts run on the **metrics** collection, which for this source only
exposes the `level` label (`name`, `tags`, `series_id` too). Since
`trpc.request` records dominate web log volume, `level` is a faithful proxy:
- **Requests by level** (line) — `sum(logs_count)` grouped by `label('level')`:
  info = healthy, warn = slow (≥`SLOW_MS`), error = failed.
- **Failed requests (error)** / **Slow requests (warn ≥500ms)** (number).
- **Chart alert** `api: failed tRPC requests spike` — threshold `>10` failed /
  5 min → current-team escalation (Slack/email). Slow-spike alert: clone it on
  the "Slow requests" chart.

### Per-path latency (p95 by `path`, errors by `code`) — needs 4 extraction rules
`path` / `durationMs` / `code` live only in the raw log JSON, **not** on the
metrics collection, so a dashboard chart can't group by them until they're
extracted. The Telemetry MCP's `create_metric_expression` tool is currently
broken (422 `better_stack_team_id`) and there's no public REST endpoint — so
add these **once in the BS UI** (Source `loyalty-web` → Metrics → add):

| Name | SQL expression | Type | Aggregations |
| --- | --- | --- | --- |
| `trpc_duration_ms` | `JSONExtract(raw, 'durationMs', 'Nullable(Float64)')` | float64 | count, avg, max, histogram |
| `trpc_path` | `JSONExtract(raw, 'path', 'Nullable(String)')` | string (low-card) | — (label) |
| `trpc_type` | `JSONExtract(raw, 'type', 'Nullable(String)')` | string (low-card) | — (label) |
| `trpc_code` | `JSONExtract(raw, 'code', 'Nullable(String)')` | string (low-card) | — (label) |

Once they exist (applies to new logs), these chart queries light up — p95 by
endpoint:
```sql
SELECT {{time}} AS time, label('trpc_path') AS series,
  histogramQuantile(0.95) AS value
FROM {{source}}
WHERE dt BETWEEN {{start_time}} AND {{end_time}} AND name = 'trpc_duration_ms'
GROUP BY time, series ORDER BY time
```
and a real slow-call alert can key off p95 instead of the warn-count proxy.

### Verifying queries against real data (no deploy needed)
Preview ships logs to Better Stack only when `BETTER_STACK_SOURCE_TOKEN_WEB` is
set for that env (it isn't on previews → they fall back to `pino`/stdout). To
get real `trpc.request` rows into the source for building/verifying charts, run
the local seed (shaped exactly like the middleware): `bun scripts/seed-trpc-perf.ts`
(gitignored ad-hoc seed). Then verify any query with `telemetry_query` /
`telemetry_chart` before persisting it — e.g. p50/p95/p99 by path:
```sql
SELECT JSONExtract(raw,'path','Nullable(String)') AS path, count() AS reqs,
  round(quantile(0.95)(JSONExtract(raw,'durationMs','Nullable(Float64)'))) AS p95
FROM remote(t538476_loyalty_web_logs)
WHERE dt > now() - INTERVAL 20 MINUTE
  AND JSONExtract(raw,'event','Nullable(String)') = 'trpc.request'
GROUP BY path ORDER BY p95 DESC
```

Pairs with: `log` (the logger + transports), `better-stack` (charts/alerts),
`rate-limit` (the sibling baseline middleware).

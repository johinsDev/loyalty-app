---
name: rate-limit
description: Rate limiting for the loyalty-app monorepo — the provider-agnostic @loyalty/rate-limit abstraction (memory / upstash / redis) + the tRPC `rateLimit` middleware. Use when protecting a procedure from abuse, adding a per-procedure limit, choosing a key (ip / user / phone), tuning the baseline, or debugging a 429 / TOO_MANY_REQUESTS.
---

# rate-limit — `@loyalty/rate-limit` + tRPC middleware

Protects tRPC procedures from being hammered. A provider-agnostic limiter
(same shape as `@loyalty/cache`: memory + upstash + redis, swap by env) sits
behind a tRPC middleware. **Every** procedure gets a generous baseline; abuse-
sensitive ones stack a tighter per-procedure rule.

```
packages/rate-limit/
├── src/
│   ├── index.ts                 barrel
│   ├── manager.ts               RateLimiter — provider selection + limit()
│   ├── types.ts                 RateLimitProvider, RateLimitRule, Duration, parseDuration
│   ├── errors.ts                RateLimitError / ProviderError / MissingDependencyError
│   ├── fake-limiter.ts          test double (counts + assertions)
│   └── providers/{memory,upstash,redis}.ts
packages/api/src/
├── trpc.ts                      baseline middleware + `rateLimit()` factory + base procedures
└── rate-limit.ts                getClientIp() + resolveKey() + RateLimitOptions
apps/{web,admin}/src/lib/rate-limit.ts   bootstrap (picks provider, bound onto ctx)
```

---

## How it fits together

1. Each app instantiates a `RateLimiter` in `src/lib/rate-limit.ts` and binds it
   onto the tRPC context (`{ ...ctx, …, rateLimiter }`) in both
   `app/api/trpc/[trpc]/route.ts` (HTTP) and `src/lib/trpc/server.ts` (RSC caller) —
   same pattern as `realtime` / `storage`.
2. `packages/api/src/trpc.ts` applies a **baseline** middleware to every procedure
   (via `baseProcedure`) and exports a `rateLimit()` factory for **overrides**.
3. The middleware reads `ctx.rateLimiter`. **If it's unbound it fails open** (skips) —
   so CLI scripts + unit tests run unthrottled.

On exceed → `TRPCError({ code: "TOO_MANY_REQUESTS" })` (HTTP 429).

---

## The baseline (automatic)

Applied to **all** procedures. Keyed per user (or IP when anonymous), different
ceiling by operation type:

| Type | Limit | Window |
| --- | --- | --- |
| query | 120 | 1m |
| mutation | 40 | 1m |

Generous enough not to bother legit use / SSR / monitoring; stops hammering.

## Per-procedure overrides

Stack `.use(rateLimit({...}))` for a tighter, **separately-counted** rule (named,
so it never shares a bucket with the baseline — the tighter one trips first):

```ts
import { protectedProcedure, rateLimit, router } from "../trpc";

add: protectedProcedure
  .use(rateLimit({ name: "sellos.add", limit: 20, window: "1m", by: "user" }))
  .input(...)
  .mutation(...)
```

`rateLimit(opts)`:
- `limit` + `window` — `window` is a `Duration` string (`"10s"`, `"1m"`, `"1h"`, `"1d"`) or raw seconds. Reads like the prose: "10 per minute" → `{ limit: 10, window: "1m" }`.
- `name` — namespaces the counter (default `"default"`). **Always set it** so two rules don't collide.
- `by` — the key (see below). Default `"ipOrUser"`.

Currently applied: `sellos.add` (20/1m), `realtime.issueTicket` (30/1m),
`realtime.publishHello` (10/1m), `pushTokens.register` (10/1m) — all `by: "user"`.

---

## Choosing the key (`by`)

The bucket key decides *who* is limited. Pick the most specific stable identity:

| `by` | Key | Use for |
| --- | --- | --- |
| `"user"` | `user:<id>` | authenticated actions (not shared across NAT). Skips if unauthenticated. |
| `"ip"` | `ip:<client ip>` | unauthenticated/public endpoints |
| `"ipOrUser"` (default) | user id if signed in, else ip | general protection |
| `(ctx, rawInput) => string \| null` | anything | **phone / email / custom** |

**IP** comes from `getClientIp()` — first hop of `x-forwarded-for`, then `x-real-ip`
(correct behind Vercel/Cloudflare). Never key off a body-supplied IP.

**Phone-keyed** (the "limit by phone, not IP" case) — pass a function that plucks
the field from the raw input; return `null` to skip when it's absent:

```ts
.use(rateLimit({
  name: "otp",
  limit: 5,
  window: "30m",
  by: (_ctx, input) => {
    const phone = (input as { phoneNumber?: string }).phoneNumber;
    return phone ? `phone:${phone}` : null;
  },
}))
```

---

## Relationship to Better Auth

Better Auth runs its **own** rate limiting on the auth endpoints — see the
`rateLimit` config + `customRules` in `packages/auth/src/server.ts` (e.g.
`/phone-number/send-otp` 3/min), plus the per-phone OTP cap `enforcePhoneOtpCap`
(counts rows in the `verification` table over 30 min). Those stay as-is and cover
sign-in / OTP. **`@loyalty/rate-limit` covers tRPC procedures**, which Better Auth
doesn't see. Both can point at the same Upstash. If you later want the OTP cap on
this abstraction, swap `enforcePhoneOtpCap` for `rateLimiter.limit(`otp:${phone}`, { limit: 5, window: "30m" })`.

---

## Providers + env

Selected by `RATE_LIMIT_PROVIDER` (shares `UPSTASH_*` / `REDIS_URL` with the cache):

| Provider | When | Notes |
| --- | --- | --- |
| `memory` | **local dev** (default) | in-process fixed window, zero deps. **Not** for serverless prod — each instance counts on its own. |
| `upstash` | **preview + prod** (default) | `@upstash/ratelimit` sliding window over REST. Atomic across instances; survives cold starts. |
| `redis` | self-host / jobs | `ioredis` `INCR`+`PEXPIRE` fixed window. Persistent socket — not for Vercel. |

Bootstrap picks the default by `VERCEL_ENV` (dev→memory, preview/prod→upstash).
The `namespace` reuses `CACHE_KEY_PREFIX`, so previews isolate counters per PR.

---

## Testing

The middleware fails open when `ctx.rateLimiter` is unset, so router tests aren't
throttled by default. To assert limiting, bind a `FakeLimiter`:

```ts
import { FakeLimiter, RateLimiter } from "@loyalty/rate-limit";

const rl = new RateLimiter({ default: "memory", stores: { memory: { provider: "memory" } }, logLevel: "silent" });
const fake = rl.fake(new FakeLimiter().block("user:abuser"));
// ...call with ctx.rateLimiter = rl...
fake.assertChecked("baseline:mutation:user:abuser");
```

`FakeLimiter` counts for real (wraps `MemoryProvider`), records every `.calls`,
and `.block(key)` force-denies a key.

---

## Per-PR namespace (preview isolation)

The bootstrap passes `namespace: env.CACHE_KEY_PREFIX` to the manager — the same
`pr-<n>:` prefix `@loyalty/cache` already gets pinned per-PR by the preview
workflow. Reusing it means every preview deploy has its **own counters** for the
same procedure, so PR A hitting `sellos.add` doesn't burn down PR B's window on
the shared staging Upstash. In prod and local dev the prefix is empty → no
namespace → one counter per `(key, rule)`. Nothing to configure in this skill;
just know why hitting the same endpoint across two previews doesn't double-count.

---

## Adding a new tighter rule to a procedure (worked example)

Concrete walkthrough for "I want to cap `clientes.invite` at **5 invites per hour
per user** (a tighter rule on top of the baseline mutation limit of 40/min)":

```ts
// packages/api/src/routers/clientes.ts (or features/clientes/router.ts)
import { protectedProcedure, rateLimit, router } from "../trpc";

invite: protectedProcedure
  .use(
    rateLimit({
      name: "clientes.invite", // unique name → its OWN counter, doesn't
                                // share with the baseline or any other rule
      limit: 5,
      window: "1h",            // reads like the prose: "5 per hour"
      by: "user",              // a logged-in user can't spread the cost
                                // across IPs; skips anonymous (which can't
                                // reach a protectedProcedure anyway)
    }),
  )
  .input(inviteSchema)
  .mutation(({ ctx, input }) => /* ... */);
```

Choosing the knobs:
- **`name`** — `<router>.<action>`. Two rules without distinct names share a bucket.
- **`limit` / `window`** — start tight. Pick the smallest number that doesn't
  break a legitimate burst. For action endpoints (invite, claim, redeem) `5/1h`
  is a sensible starting point; for OTP-style `5/30m`. Tighten later if you see
  abuse, loosen later if you see legit hits.
- **`by`** — `"user"` for protected endpoints where a single account shouldn't
  flood. `"ip"` for unauthenticated endpoints. `"ipOrUser"` for endpoints that
  serve both (default). A **function** for unusual keys (phone, invoice id, …) —
  return `null` to skip the rule entirely when the field is absent.

The baseline (`40/min` mutation) continues to apply on top under a separate
`baseline:mutation:<key>` counter — defence in depth.

---

## Adding a new provider (5 steps)

Mirror the `cache` skill's runbook:

1. **Implement** `RateLimitProvider` in `packages/rate-limit/src/providers/<name>.ts`:

   ```ts
   export class MyProvider implements RateLimitProvider {
     readonly name = "my-provider";
     async limit(key: string, rule: RateLimitRule): Promise<RateLimitResult> { /* ... */ }
     async reset?(key: string) { /* ... */ }
     async disconnect?() { /* if you hold a connection */ }
   }
   ```

   Use `dynamicImport("<sdk>")` from `providers/_lazy.ts` to load the SDK so apps
   that don't pick this provider don't carry the dep.
2. **Extend** the `ProviderConfig` union in `types.ts`:
   ```ts
   export interface MyProviderConfig { provider: "my-provider"; /* connection */ }
   export type ProviderConfig = /* …existing… */ | MyProviderConfig;
   ```
3. **Wire** the new branch into `createProvider()` in `manager.ts`:
   ```ts
   case "my-provider": return new MyProvider(config);
   ```
4. **Add a unit test** under `__tests__/providers/<name>.test.ts`:
   - exercise the window edge (limit, then +1 trips, then expiry resets);
   - assert `MissingDependencyError` when the SDK is uninstalled.
5. **Update bootstrap + env**:
   - extend `apps/{web,admin}/src/env.ts` `RATE_LIMIT_PROVIDER` enum;
   - add the conditional config block in `lib/rate-limit.ts`;
   - bump `peerDependencies` on `packages/rate-limit/package.json`;
   - add the SDK to `knip.json` under `packages/rate-limit.ignoreDependencies`.

---

## Gotchas

- **Memory in serverless = broken limits.** Each lambda has its own Map, so the
  effective limit ≈ `limit × instances`. Always `upstash` in preview/prod.
- **Fail-open is intentional.** No bound limiter → no throttle. If a deploy "isn't
  limiting", check `rateLimiter` is bound on the ctx + `RATE_LIMIT_PROVIDER`/Upstash creds.
- **Name your counters.** Two `rateLimit()` rules without distinct `name`s share a
  bucket. The baseline uses `baseline:<type>:<key>`.
- **`by: "user"` skips anonymous callers** (returns `null`). Use `"ipOrUser"` if a
  public-ish procedure must still be limited when signed out.
- **Window edges:** `redis`/`memory` are fixed-window (a burst can straddle two
  windows). `upstash` is sliding-window (smoother). Fine for abuse protection.

---

## Troubleshooting

- **"My endpoint isn't getting limited."**
  1. Confirm `RATE_LIMIT_PROVIDER` is set in that env (or that the cascade picks
     a usable default — `memory` in dev needs no creds; `upstash` needs them).
  2. Confirm the app bootstrap binds `rateLimiter` onto the ctx in BOTH
     `app/api/trpc/[trpc]/route.ts` AND `src/lib/trpc/server.ts` (RSC + HTTP).
     Forgetting the second one means SSR callers stay unthrottled.
  3. With Upstash: confirm `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`
     are present in the Vercel env for that deploy.
- **"The baseline trips before my override."**
  Defence in depth — the baseline is `40 mutations / 1m` per user. If your override
  is `5 / 1h` you want the override to trip first within an hour, but a fast
  burst will hit the baseline first. That's fine: the user sees a 429 either way.
  If you want a per-call action that's *more* generous than the baseline (rare),
  raise the baseline at the source in `packages/api/src/trpc.ts`.
- **"It works locally but trips on every other request in preview/prod."**
  You probably left `RATE_LIMIT_PROVIDER=memory` in a serverless env. Switch to
  upstash — memory counts per lambda instance, so the effective limit is way
  lower than declared.
- **429 returned but you expected a different error.**
  Order matters. Middleware chain is `withBaseline` → `enforceAuth` (for
  protected) → your `.use(rateLimit({...}))` overrides. If you want the auth
  check first, add the override AFTER `enforceAuth` happens (which it always
  does when stacking on `protectedProcedure`).

---

## References

- `packages/rate-limit/src/*` — the abstraction (mirrors `@loyalty/cache`).
- `packages/api/src/trpc.ts` — baseline + `rateLimit()` factory.
- `packages/api/src/rate-limit.ts` — `getClientIp` + `resolveKey`.
- `apps/{web,admin}/src/lib/rate-limit.ts` — bootstrap.
- `.claude/skills/cache/SKILL.md` — the sibling provider-agnostic package.
- `@upstash/ratelimit` — https://github.com/upstash/ratelimit-js

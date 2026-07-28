# Cache Components adoption plan

Next.js 16 **Cache Components** (the flag that implies PPR + `use cache` +
`cacheLife`/`cacheTag`) for this monorepo (admin CRM + customer PWA, both
`[locale]` next-intl apps, data fetched via tRPC-over-HTTP to a Cloudflare
Worker).

This is a **playbook + backlog**, not a spec to execute blindly. Each action says
what it is, why it helps us, how to do it, and where it lands in our code. Actions
are split into **do-now** (work today, no blockers) and **gated** (blocked by an
upstream limitation — documented so we pick them up when the blocker lifts).

> Companion: the `nextjs-data-fetching-patterns` skill is the per-feature decision
> guide; this doc is the app-wide Cache Components rollout view. Read both before a
> fetching refactor.

## Where we stand today

- **admin** (`apps/admin/next.config.ts`): `cacheComponents: true` + `typedRoutes: true`.
  **Missing `partialPrefetching`.** In practice the static shell **de-opts** because
  next-intl's `<NextIntlClientProvider>` reads request data — see [Structural
  limit 1](#limit-1-i18n-blocks-cachecomponents). So we pay the discipline cost
  without the instant-nav payoff yet.
- **web** (PWA): `typedRoutes: true`, **no `cacheComponents`**. It's the better fit
  per Next's own guidance (public-ish, feed-like) but is also a `[locale]` app, so
  it hits the same i18n blocker.
- We already do one thing right: `getBranding()` uses `use cache` +
  `cacheTag("branding")` + `cacheLife` — the template for any **public, shared**
  read.

## Mental model (5 bullets)

1. **Inverted default:** everything is dynamic per-request unless a scope opts into
   caching with `'use cache'`. Caching is a visible choice in code.
2. **One flag, implies PPR:** `cacheComponents: true` replaces `experimental.ppr` /
   `dynamicIO` / `useCache` and the whole `unstable_cache` / `force-*` / `revalidate`
   family. Don't set the old knobs.
3. **Static shell vs dynamic holes:** synchronous content + `use cache` results +
   Suspense **fallbacks** prerender into a shared shell; uncached async work streams
   in behind `<Suspense>`.
4. **The build enforces it:** async work that is neither cached nor inside
   `<Suspense>` **fails the build**. Three failures → three fixes (wrap in Suspense /
   add `use cache` / use `use cache: private`).
5. **The shell is identical for every visitor → the router prefetches and commits
   navigation with no server round-trip.** That's where "instant navigation" comes
   from; per-link data streams after the click.

---

## Do-now actions (flag-independent — no upstream blocker)

These deliver ~80% of the perceived win (instant nav + skeleton islands) and do
**not** require a broad `use cache` rollout, so they sidestep the next-intl blocker.

### N1 — Enforce `params.then()` / `searchParams.then()` (never top-level `await`)

- **What:** returning the page component **synchronously** and resolving dynamic
  inputs inside `.then()` (or `Promise.all([...]).then()`), so chrome above the hole
  bakes into the static shell. A top-level `await params/searchParams` makes the
  **entire page dynamic**.
- **Why us:** it's already our CLAUDE.md hard rule and the customers/purchases/
  dashboard fixes this session applied it. This just finishes the sweep.
- **How:** audit every `app/[locale]/**/page.tsx`; convert any top-level
  `const x = await searchParams` into `searchParams.then(sp => …)` inside a
  `<Suspense>`. `generateMetadata` may keep `await params` (runs before render).
- **Where:** `apps/{admin,web}/app/[locale]/**`. Reference: the purchases page.

### N2 — Turn on `partialPrefetching: true` in admin

- **What:** the flag that makes a visible `<Link>` prefetch the destination's
  **shared App Shell**, enabling instant commit on click.
- **Why us:** admin has `cacheComponents` but **not this** — we're missing the exact
  lever that makes nav feel instant. Highest ROI single line here.
- **How:** add `partialPrefetching: true` to `apps/admin/next.config.ts`. Verify on a
  preview that nav between admin routes commits without a spinner.
- **Caveat:** validate against the i18n de-opt (Limit 1) — if the shell is still
  dynamic, prefetch gains are muted until that's resolved. Measure before/after.

### N3 — Formalize the island triple: **Shell + List + Skeleton**, Suspense owned by the page

- **What:** each widget exports three things — an async `List`, a synchronous
  `Shell` (heading/border), and a shaped `Skeleton` — and the **page/layout** owns
  the `<Suspense fallback={<Skeleton/>}>`. The feature never pre-wraps Suspense.
- **Why us:** our `data-table` already ships skeletons; this standardizes the shape
  so every admin/web list streams the same way and the static chrome always paints.
- **How / rules:** 2–5 skeleton rows (not the real count); **never `fallback={null}`**
  for visible UI; **never wrap a whole page** in one skeleton; keep resolved + fallback
  JSX inline in the page; group heading + variable content in one boundary only when
  the height is unknown (avoids CLS).
- **Where:** evolve `packages/ui` data-table + each `src/features/<x>/components`.

### N4 — Hover-intent prefetch for low-intent link lists

- **What:** a `<Link>` that stays shell-only (`prefetch={null}`) until
  `onMouseEnter`/`onFocus`, then upgrades to `prefetch={true}` — so a list of N row
  links doesn't wake N servers on render.
- **Why us:** admin tables render many row/detail links; blanket `prefetch` is
  wasteful, none is slow. Hover-intent is the middle ground.
- **How:** add a `HoverPrefetchLink` wrapper over our `@/i18n/navigation` `Link`
  (keep the locale-aware Link underneath). Reference: Aurora's
  `components/ui/hover-prefetch-link.tsx`.

### N5 — Migrate error boundaries to `unstable_catchError` (`next/error`, 16.2+)

- **What:** an error boundary that understands Next control-flow throws
  (`notFound()`, `redirect()`, `unauthorized()`, `forbidden()`) and **re-fetches
  server data on retry** — unlike `react-error-boundary`, which swallows those and
  doesn't refetch.
- **Why us:** we wrap suspending islands with `react-error-boundary`; on a transient
  Worker error the current boundary can't cleanly recover.
- **How:** build one `ErrorBoundary` in `packages/ui` using `unstable_catchError`;
  wrap each suspending island (`<Suspense>` child) with it.

### N6 — Lean on React `<Activity>` for cross-navigation state

- **What:** with `cacheComponents`, a route you navigate away from is **hidden, not
  unmounted** — its state survives when you return.
- **Why us:** admin is tab/filter heavy; free state preservation improves the
  back-and-forth feel. No code change beyond keeping state in the island.
- **How:** nothing to wire; just don't reset island state on unmount assumptions.
  Verify the behavior once admin's shell is genuinely static (post-Limit-1).

---

## Gated actions (do later — blocked upstream; documented so we don't forget)

### L1 — Broad `use cache` rollout on reads

- **Blocked by:** [Limit 1 (i18n)](#limit-1-i18n-blocks-cachecomponents) **and**
  [Limit 2 (Worker-BFF, per-user session)](#limit-2-worker-bff--per-user-session).
- **What it'd be:** push feature reads into `cache(async () => { 'use cache';
  cacheTag(broad, scoped); … })`, with session/locale/searchParams resolved
  **outside** and passed in as args (serializable only).
- **Why later:** most of our reads carry the session cookie → per-user → not
  shareable with plain `use cache`; and the locale read de-opts today.

### L2 — `use cache: private` for the session read

- **What:** cache the current-user/session read **per browser session** (never on the
  server), so the auth-gate stops re-hitting the store each navigation.
- **Why us:** this is the Cache-Components-native answer to the same latency we chased
  with cookieCache/secondaryStorage — but it applies to a **direct `cookies()` read**,
  while our session lives behind the Worker's `auth.me` (tRPC-over-HTTP). Adopting it
  means reworking how the FE reads the session (read the cookie locally vs. round-trip
  the Worker). Design before building.
- **Blocked by:** needs the i18n blocker resolved first (it's in the same shell).

### L3 — Tag-based mutation revalidation (`updateTag` / `revalidateTag`)

- **Blocked by:** [Limit 2](#limit-2-worker-bff--per-user-session). Our mutations run
  on the **Worker**, not Next Server Actions, so the elegant "tag, cache, invalidate"
  loop (`updateTag` for read-your-own-writes, `revalidateTag` for side-effects) doesn't
  map. We stay on **react-query invalidation** (already the skill's guidance).
- **Where it *does* apply now:** public, server-cached data with no Worker write in the
  loop — e.g. `branding` (already `use cache` + `cacheTag`). A thin `'use server'`
  action calling `revalidateTag("branding")` after a settings change is the only place
  worth wiring tags today.

### L4 — next-intl `next/root-params` migration (unblocks Limit 1)

- **What:** the maintainer-endorsed pattern to make next-intl work under
  `cacheComponents`: enable `experimental.rootParams`, read the locale from
  `next/root-params` in `i18n/request.ts`, drop `setRequestLocale`, pass **no** i18n
  props to the provider, and make `[locale]` a true root param (**delete
  `app/layout.tsx`**, render `<html>` in `[locale]/layout.tsx`).
- **Why later / risk:** it's **experimental** and the maintainer states cacheComponents
  is *not supported yet* — gated on Next.js making `rootParams` usable **inside**
  `use cache`. Known sharp edges: next-intl's `<Link>` breaks inside a `use cache`
  scope (won't-fix for now), `getTranslations` in `use cache` needs an explicit
  `locale`, and the locale can be "randomly lost" on locale switch (mitigate with
  `generateStaticParams`). Also requires reversing our CLAUDE.md `setRequestLocale`
  rule. **Prototype one route before any rollout.**
- **Decision (2026-07-28):** parked; live with the dev-only overlay (prod silently
  de-opts to dynamic and works). Revisit when Next.js ships `rootParams`-in-`use cache`.

---

## Structural limits (why we can't just copy the reference repos)

The public reference (`aurorascharff/next16-social-media`) and the certificates.dev
walkthrough are **not internationalized** and call the DB **directly in RSC**. Two
differences gate how much applies to us.

### Limit 1 — i18n blocks Cache Components {#limit-1-i18n-blocks-cachecomponents}

`<NextIntlClientProvider>` (server) still calls `getFormats()` + `getConfigNow()`
even when you pass `locale`/`messages`/`timeZone`, which re-resolves
`i18n/request.ts` → reads the request (`requestLocale`/headers/cookies) → "Runtime
data accessed outside `<Suspense>`". Maintainer-confirmed: **next-intl doesn't support
`cacheComponents` yet**, gated on Next.js. Fix path = [L4](#l4). Until then, `[locale]`
apps can't get the clean static shell.

### Limit 2 — Worker-BFF + per-user session {#limit-2-worker-bff--per-user-session}

The reference calls Prisma directly in the RSC. We call **tRPC-over-HTTP to a
Cloudflare Worker**, and every read carries the **session cookie** → most reads are
**per-user** (not shareable via plain `use cache`; need `use cache: private` or stay
dynamic). And **mutations run on the Worker, not Server Actions**, so the
`updateTag`/`revalidateTag` mutation loop doesn't apply — we keep react-query
invalidation. Tag-based caching is only a fit for **public, shared** data (branding).

---

## Bottom line / sequencing

1. **Now:** N1 (finish `params.then`), **N2 (`partialPrefetching` — start here)**, N3
   (island triple), N4 (hover-intent), N5 (`next/error` boundary), N6 (`<Activity>`).
   None need broad `use cache`; none fight next-intl.
2. **Measure** admin nav before/after N2 on a preview to quantify how much the i18n
   de-opt (Limit 1) mutes the gain.
3. **Later, gated:** L1–L3 wait on Limit 2 (architecture) and L4/Limit 1 (Next.js +
   next-intl). Don't invest in a broad `use cache` rollout until L4 is viable.

## References

- Reference repo: `github.com/aurorascharff/next16-social-media` — cleanest
  `params.then` + island-Suspense (`app/page.tsx`, `app/u/[handle]/page.tsx`),
  cache/tag/invalidate (`features/drop/drop-queries.ts` + `drop-actions.ts`),
  hover-intent (`components/ui/hover-prefetch-link.tsx`).
- Blog: `certificates.dev/blog/cache-components-in-nextjs`.
- Aurora Scharff, "Implementing Next.js 16 'use cache' with next-intl":
  `aurorascharff.no/posts/implementing-nextjs-16-use-cache-with-next-intl-internationalization/`.
- next-intl ↔ cacheComponents status: `github.com/amannn/next-intl/issues/1493`,
  `#2068`, `#2229` (Link-in-`use cache`).

---
name: ci-cd
description: GitHub Actions pipeline for the loyalty-app monorepo (lint, format, knip, typecheck, vitest, Vercel CLI deploy, Playwright). Use when adding a step, debugging a failing run, rotating Vercel/Turbo secrets, disabling Vercel's native auto-deploy, or onboarding a teammate to "how does code reach production".
---

# CI / CD — pipeline cookbook

CI is the source of truth for **everything that touches main or a PR**. Vercel is a dumb deploy target: GitHub Actions runs every check, builds artifacts, and pushes them via the Vercel CLI. The Vercel UI's native Git auto-deploy is **disabled**; deploys ONLY happen via this pipeline.

```
   push / PR
      │
      ▼
   ┌────────────────────────────────────────────────┐
   │ validate                                       │
   │   bun install                                  │
   │   lint  (oxlint via turbo)                     │
   │   format check  (oxlint --check via turbo)     │
   │   knip  (dead code / unused deps)              │
   │   typecheck  (tsc via turbo)                   │
   │   test  (vitest via turbo)                     │
   └────────────────────────────────────────────────┘
      │            │
      ▼            ▼
   deploy-web    deploy-admin
      │            │
      │ vercel pull --environment=preview|production
      │ vercel build (--prod)
      │ vercel deploy --prebuilt (--prod)
      │ comment URL on PR
      │            │
      └─────┬──────┘
            ▼
         e2e (Playwright)
            │ runs against deploy URLs
            └─ uploads traces on failure
```

The workflow file is `.github/workflows/ci.yml`. The Playwright workspace is `apps/e2e`.

---

## 1. One-time setup

### a) GitHub repo secrets

Settings → Secrets and variables → Actions → **New repository secret**:

| Name | What |
| --- | --- |
| `VERCEL_TOKEN` | Account-level token. Generate at https://vercel.com/account/tokens. |
| `VERCEL_ORG_ID` | From `.vercel/project.json` after running `vercel link` once locally. Or Vercel dashboard → team settings → General → "Team ID". |
| `VERCEL_PROJECT_ID_WEB` | The Vercel project id for `loyalty-web`. Find it in Vercel → project → Settings → General → "Project ID". |
| `VERCEL_PROJECT_ID_ADMIN` | Same for `loyalty-admin`. |
| `TURBO_TOKEN` (optional) | Vercel's turbo remote cache token. Settings → Tokens. Speeds up CI. |

GitHub variables (Settings → Variables → Actions):

| Name | Value |
| --- | --- |
| `TURBO_TEAM` | The Vercel team slug (used by Turbo for cache scoping). Optional — only matters if `TURBO_TOKEN` is set. |

### b) Disable Vercel's native auto-deploy

For each Vercel project (`loyalty-web`, `loyalty-admin`):

1. Project → **Settings** → **Git**.
2. Either:
   - **Easiest**: scroll to "Production Branch" → click "Disconnect" (the project stays linked to GitHub for env loading but Vercel won't trigger builds).
   - **More surgical**: leave the link but set "Ignored Build Step" to:
     ```bash
     exit 0
     ```
     This makes Vercel skip every push from Git. Builds/deploys happen only via `vercel deploy` from CI.
3. Save.

After this, pushing to GitHub triggers GitHub Actions only. Vercel waits passively for `vercel deploy` calls.

### c) Verify

```bash
git push origin main      # GH Actions kicks in
gh run list --limit 5     # confirm validate + deploy-web + deploy-admin all pass
gh pr create ...          # PRs get sticky comments with preview URLs
```

---

## 2. The `validate` job (every push, every PR)

Steps:

1. Checkout.
2. Bun pinned to `1.2.10` (matches root `package.json#packageManager`).
3. Cache `.turbo/` keyed by SHA → speeds repeat runs.
4. `bun install --frozen-lockfile` — fails if `bun.lock` drifted.
5. `bun run lint` — `oxlint` via turbo across every package.
6. `bun run format:check` — same as lint with `--check`, no fixes applied.
7. `bun run knip` — dead code, unused deps, unused exports. Config in `knip.json`.
8. `bun run typecheck` — `tsc --noEmit` across every package.
9. `bun run test` — vitest run across every package.

If any step fails, the job fails and **deploy jobs do not start** (`needs: validate`). The whole pipeline takes ~3-5 min on a warm cache.

### Placeholder env vars

The validate job sets fake values for `DATABASE_URL`, `BETTER_AUTH_SECRET`, etc. Real secrets aren't needed for unit tests; this only exists so build/test scripts that read env via `dotenv -e .env --` don't spook out.

If a test really needs a real-looking value (e.g. you start using `t3-env` and it validates URL format), add it here.

---

## 3. The `deploy-*` jobs

`deploy-web` and `deploy-admin` run **after** `validate` succeeds. Both follow the same template — they only differ in `VERCEL_PROJECT_ID`.

Each deploy:

1. Installs Vercel CLI globally with bun.
2. `vercel pull --environment=production|preview` — fetches the project's env vars + `.vercel/project.json`.
3. `bun install --frozen-lockfile` — installs workspace deps so `vercel build` resolves them.
4. `vercel build [--prod]` — builds locally using Vercel's own builder. Output goes to `.vercel/output/`.
5. `vercel deploy --prebuilt [--prod]` — uploads the prebuilt output, no build server-side.
6. Captures the deploy URL.
7. On a PR, posts a sticky comment with the preview URL.

### Why `--prebuilt`

Building inside the GH Actions runner gives us:

- One artifact format: if it builds in CI, it deploys; otherwise it never reaches Vercel.
- Same `bun install` and `node_modules` as the rest of CI — no `Cannot find module @loyalty/log` mismatches.
- Cheaper Vercel build minutes (we don't pay for their builder).

### Production vs preview

| Branch | Behavior |
| --- | --- |
| `main` push | `vercel pull --environment=production` + `vercel deploy --prod`. Promotes to the production domain. |
| Any other branch / PR | `vercel pull --environment=preview` + `vercel deploy` (no `--prod`). Generates a unique preview URL. |

### Rollback

GitHub Actions does NOT manage rollbacks. To roll back:

1. Vercel dashboard → project → Deployments.
2. Find the last good deploy → ⋯ → **Promote to Production**.
3. Open the affected app → confirm.
4. Note in `#alerts-loyalty` what you did.

The pipeline isn't gating rollbacks because they're rare and time-sensitive.

---

## 4. The `e2e` job (Playwright)

Currently **disabled** by `if: false` in the workflow (no specs to run yet). Specs live in `apps/e2e/tests/*.{web,admin}.spec.ts`.

When you have specs worth running:

1. Remove the `if: false` (or change to `if: always()`).
2. Specs receive deploy URLs via env: `E2E_WEB_URL` and `E2E_ADMIN_URL` come from the `deploy-web` / `deploy-admin` job outputs.
3. Failures upload `apps/e2e/test-results/` as a workflow artifact (traces, videos, screenshots).

The Playwright config (`apps/e2e/playwright.config.ts`) defines 3 projects:

- `web-chromium`: runs `*.web.spec.ts` against `E2E_WEB_URL`.
- `admin-chromium`: runs `*.admin.spec.ts` against `E2E_ADMIN_URL`.
- `web-webkit`: same as `web-chromium` but on Safari engine. iOS PWA coverage.

Two smoke specs ship as a starting point: `health.web.spec.ts` and `health.admin.spec.ts`. They hit `/api/health` and assert `{ status: "ok" }`.

### Running locally

```bash
# point at running dev servers
E2E_WEB_URL=http://localhost:3002 \
E2E_ADMIN_URL=http://localhost:3003 \
bun --cwd apps/e2e run test

# watch mode (UI)
bun --cwd apps/e2e run test:ui
```

Browsers must be installed once:

```bash
bun --cwd apps/e2e exec playwright install --with-deps chromium webkit
```

---

## 5. Conventions

- **Every PR must pass `validate`** before merge — set this as a required check in GitHub Settings → Branches → main → branch protection rules.
- **Deploys are idempotent**: re-running `deploy-web` / `deploy-admin` regenerates the deploy from the same SHA.
- **Don't add manual deploy steps in `package.json`**: the only way to deploy is through GitHub Actions. Local `vercel deploy` runs (without going through CI) are debugging-only — they don't pass through validate.
- **Secrets rotation**: rotate `VERCEL_TOKEN` quarterly. After rotation, update GH secret + verify a single push deploys cleanly before walking away.

---

## 6. Adding a step

Most common: a new check.

1. Edit `.github/workflows/ci.yml`, add a step inside the `validate` job. Keep them under 2 min each so the whole job stays under 5 min.
2. Mirror the same step in `lefthook.yml` if it makes sense as a pre-commit (typically lint, format, typecheck — not knip, not vitest because they're slow).
3. PR → confirm CI passes → merge.

Most common: a new deploy target (e.g. a future `apps/cashier`).

1. Create the Vercel project the same way `loyalty-web` and `loyalty-admin` were created (see `.claude/skills/vercel/SKILL.md`).
2. Add `VERCEL_PROJECT_ID_CASHIER` as a GH secret.
3. Copy the `deploy-admin` job to `deploy-cashier` and swap the env var.
4. PR.

---

## 7. Troubleshooting

### "Couldn't find Vercel project linked to this directory"

`vercel pull` needs `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID` env. Both come from `secrets`. If they're missing, the step exits with that message.

### "Failed to download `@vercel/build-utils`" / sporadic CLI errors

Vercel CLI registry hiccup. Re-run the failed job — it's flaky once a month.

### `bun install --frozen-lockfile` fails

Lockfile drifted. Regenerate locally with `bun install`, commit `bun.lock`, push.

### Deploy succeeds but the URL 500s

Almost always missing env var on the Vercel project. `vercel pull --environment=production` confirms what's there. Add the missing var via Vercel UI → Settings → Environment Variables → re-deploy by re-running the workflow.

### "ignored build step" still triggering Vercel-side build

Check Settings → Git → Production Branch is disconnected (or Ignored Build Step really returns `exit 0`). Vercel sometimes caches the previous setting for ~1 min after toggling.

### Knip flags a real false positive

Edit `knip.json` → add to `ignore` (path) or `ignoreDependencies` (package name). Don't suppress at the source-code level (`// knip-ignore`) unless really one-off.

### Test pollution between turbo runs

Tests share a process per package. If a test mutates global state (env, mocks not restored) it'll fail in CI but pass locally. Fix: `vi.restoreAllMocks()` in `afterEach`.

---

## 8. Why this pipeline shape

A few decisions worth recording:

- **GH Actions over Vercel auto-deploy**: gives us pre-deploy gates (tests, knip) and a single audit trail. Vercel's native pipeline is great for "just deploy" but skips every check.
- **Build with `--prebuilt`**: bun and turbo cache benefits stay in our control; same artifact tested in CI lands in prod.
- **Sticky PR comments**: see preview URLs without leaving the PR. Use `marocchino/sticky-pull-request-comment@v2` to avoid comment spam on rebuilds.
- **Playwright sectioned by app**: web and admin have different APIs/UX, so projects scoped by spec name (`*.web.spec.ts`, `*.admin.spec.ts`) prevent leaking expectations.

---

## Where to look first

- `.github/workflows/ci.yml` — the actual workflow.
- `knip.json` — dead-code config.
- `apps/e2e/` — Playwright specs + config.
- `.claude/skills/vercel/SKILL.md` — how the Vercel projects were created (referenced in deploy steps).
- `.claude/skills/tooling/SKILL.md` — for lint/format/commitlint conventions referenced in `validate`.

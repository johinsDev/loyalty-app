# Preview smoke

A throwaway PR pointing at this file exists for one reason: **exercise the
per-PR preview pipeline end to end and let a human click through it.**

Opening (or pushing to) a PR triggers `.github/workflows/preview.yml`, which —
when `PREVIEW_PIPELINE_ENABLED=true` — clones + masks the prod Turso DB into
`preview-pr-<n>`, deploys the per-PR API Worker, and wires the Vercel FE
previews. The `clone + mask preview DB, wire Vercel` job smoke-tests the Worker
(`scripts/cloudflare/smoke-preview-worker.ts`).

## URLs to review (replace `<n>` with the PR number)

| Surface | URL | Expect |
| --- | --- | --- |
| API Worker (root) | `https://api.pr-<n>.t4diverclub.app/` | `loyalty-api ok` |
| tRPC health | `https://api.pr-<n>.t4diverclub.app/trpc/health.ping?batch=1&input=%7B%7D` | `{"ok":true}` |
| Auth mounted | `https://api.pr-<n>.t4diverclub.app/api/auth/get-session` | HTTP 200 (null session) |
| Admin CRM | `https://admin.pr-<n>.t4diverclub.app/` | `/sign-in` loads (magic-link form) |
| Customer PWA | `https://app.pr-<n>.t4diverclub.app/` | landing / `/sign-in` loads |

> **FE previews return HTTP 401 to anonymous requests — that's expected.**
> The Vercel admin/web previews sit behind **Vercel Authentication
> (Deployment Protection)**: an anonymous `curl` gets `401` + a
> `_vercel_sso_nonce` cookie (`server: Vercel`). It is NOT a broken deploy.
> To view them, open the URL while logged into the Vercel team (the SSO flow
> lets you through — easiest via the Vercel comment on the PR). The Cloudflare
> API Worker (`api.pr-<n>`) is public, so it returns 200. To smoke-test the FE
> **automatically**, you need a Protection Bypass for Automation token
> (`x-vercel-protection-bypass` header / `?_vercel_share=` link), otherwise the
> probe always sees 401.

## Manual smoke checklist (per preview)

- [ ] API Worker root + `health.ping` green (the CI smoke covers this)
- [ ] Admin `/sign-in` renders; request a magic-link → lands in the `email_outbox`
      (preview uses `EMAIL_PROVIDER=outbox`, so check the admin email-outbox view,
      not a real inbox)
- [ ] Web `/sign-in` renders; phone-OTP path reachable (no Google in preview)
- [ ] A masked-DB read works (customer list loads, PII is masked)

## Re-trigger without code changes

```bash
git commit --allow-empty -m "chore: re-trigger preview smoke" && git push
```

The preview tears down automatically on PR close (`preview-cleanup.yml`).

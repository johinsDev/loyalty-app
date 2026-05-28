/**
 * Whether email/password sign-in is exposed in the admin app.
 *
 * Production is **Google-only** by policy. Preview deploys (where
 * Google OAuth redirect URIs are painful on per-PR hashed subdomains)
 * and local dev fall through to enabled — paired with the
 * deterministic preview admin seeded by `db:seed:preview-admin`,
 * that lets anyone log into any preview with a fixed credential.
 *
 * Mirrors the gating shape of `./dev-only.ts` (VERCEL_ENV-driven).
 * Server-only: only read on the server (route handler, server
 * components). Pass the resolved boolean down to client components
 * as a prop — never reference this directly from a `"use client"`
 * file, since `VERCEL_ENV` is not exposed to the browser.
 */
export function isPasswordAuthEnabled(): boolean {
  return process.env.VERCEL_ENV !== "production";
}

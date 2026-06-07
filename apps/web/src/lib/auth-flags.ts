/**
 * Whether the Google sign-in button is shown on web.
 *
 * Google OAuth needs a fixed redirect URI, which per-PR preview Workers
 * (`api.pr-N.…`) can't have — so the preview Worker isn't given `GOOGLE_*` and
 * its social endpoint 404s. Hide the button on preview; show it in dev + prod.
 *
 * Server-only: `VERCEL_ENV` isn't exposed to the browser, so resolve this on the
 * server and pass the boolean down as a prop. Mirrors apps/admin's `auth-flags`.
 */
export function isGoogleEnabled(): boolean {
  return process.env.VERCEL_ENV !== "preview";
}

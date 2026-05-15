/**
 * Resolves the public URL of this web app at runtime.
 *
 * Cascade (server side):
 *   1. NEXT_PUBLIC_APP_URL — explicit override; set for a custom
 *      domain or cross-app auth testing in preview.
 *   2. VERCEL_PROJECT_PRODUCTION_URL — the *stable* production alias
 *      (loyalty-app-web.vercel.app). This is what the browser hits
 *      and what must match Better Auth's origin check + Google's
 *      redirect_uri, so it has to win over the deployment URL.
 *   3. VERCEL_URL — the per-deployment URL with a hash
 *      (loyalty-app-web-abc123.vercel.app). Only stable per deploy,
 *      so it's the right value for *preview* deploys (no prod alias).
 *   4. http://localhost:3002 — local dev fallback.
 *
 * Browser side: `window.location.origin` always wins.
 */
export function getAppUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3002";
}

/**
 * Resolves the public URL of this admin app at runtime.
 *
 * Cascade (server side):
 *   1. BETTER_AUTH_URL — explicit override; set when a custom domain
 *      is in use, or for cross-app auth testing in preview.
 *   2. VERCEL_URL — auto-injected by Vercel on every deploy.
 *   3. http://localhost:3003 — local dev fallback.
 *
 * Browser side: `window.location.origin` always wins.
 */
export function getAppUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3003";
}

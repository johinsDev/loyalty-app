/**
 * Resolves the public URL of this web app at runtime.
 *
 * Cascade (server side):
 *   1. NEXT_PUBLIC_APP_URL — explicit override; set when a custom domain
 *      is in use, or for cross-app auth testing in preview.
 *   2. VERCEL_URL — auto-injected by Vercel on every deploy
 *      (preview and production), so previews "just work".
 *   3. http://localhost:3002 — local dev fallback.
 *
 * Browser side: `window.location.origin` always wins.
 */
export function getAppUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3002";
}

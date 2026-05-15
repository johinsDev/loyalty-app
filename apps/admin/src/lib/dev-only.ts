/**
 * Gate for endpoints and pages that should NOT exist in production.
 * Vercel sets `VERCEL_ENV=production` on prod deploys. Preview and
 * local dev fall through to enabled. Override with
 * `WHATSAPP_OUTBOX_ENDPOINT_ENABLED=true` in the rare case a prod
 * debug requires it.
 *
 * Mirror of apps/web's helper — admin owns dev tooling now, but the
 * customer PWA may still pick up dev-only routes in the future.
 */
export function isDevOnlyEnabled(): boolean {
  if (process.env.WHATSAPP_OUTBOX_ENDPOINT_ENABLED === "true") return true;
  if (process.env.VERCEL_ENV === "production") return false;
  return true;
}

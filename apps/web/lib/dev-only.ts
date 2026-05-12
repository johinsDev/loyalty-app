/**
 * Gate for endpoints and pages that should NOT exist in production.
 * Vercel sets `VERCEL_ENV=production` on prod deploys. Preview and
 * local dev fall through to enabled. Override with
 * `WHATSAPP_OUTBOX_ENDPOINT_ENABLED=true` in the rare case a prod
 * debug requires it.
 *
 * Both `/api/whatsapp-outbox/*` and `/[locale]/whatsapp-outbox/*`
 * import this so they stay in sync.
 */
export function isDevOnlyEnabled(): boolean {
  if (process.env.WHATSAPP_OUTBOX_ENDPOINT_ENABLED === "true") return true;
  if (process.env.VERCEL_ENV === "production") return false;
  return true;
}

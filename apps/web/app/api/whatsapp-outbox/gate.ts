/**
 * The `/api/whatsapp-outbox` endpoints only serve preview deploys and
 * local dev. Production returns 404. Vercel sets `VERCEL_ENV=preview`
 * for preview deploys and `VERCEL_ENV=production` for prod — local dev
 * has neither set, so we fall through to "enabled".
 *
 * Override with `WHATSAPP_OUTBOX_ENDPOINT_ENABLED=true` if someone
 * needs to debug a prod deploy (and accept the read exposure that
 * implies). Default: disabled in production.
 */
export function isOutboxEndpointEnabled(): boolean {
  if (process.env.WHATSAPP_OUTBOX_ENDPOINT_ENABLED === "true") return true;
  if (process.env.VERCEL_ENV === "production") return false;
  return true;
}

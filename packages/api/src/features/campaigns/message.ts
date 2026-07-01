import type { ChannelName } from "@loyalty/notifications";
import type { CampaignMessage } from "@loyalty/db/schema";

/**
 * Pure helpers shared by the service (reach preview / validation) and the
 * `send-campaign` job (per-recipient rendering + single-channel resolution).
 * Kept free of Drizzle/Trigger so both sides can import it.
 */

/** Delivery channels a promotional campaign can pick from, in the admin's terms. */
export const CAMPAIGN_CHANNELS = ["push", "email", "sms", "whatsapp"] as const;
export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number];

/** Merge tokens the admin can insert; rendered per-recipient at send time. */
export const MERGE_VARS = [
  "nombre",
  "nivel",
  "puntos",
  "sucursal",
  "short_link",
] as const;
export type MergeVar = (typeof MERGE_VARS)[number];
export type MergeVars = Partial<Record<MergeVar, string>>;

/** Map a campaign channel to its `@loyalty/notifications` channel name. */
export function toNotificationChannel(c: CampaignChannel): ChannelName {
  return c === "email" ? "mail" : c;
}

/**
 * Replace `{{var}}` tokens with the recipient's values. Unknown/missing tokens
 * collapse to an empty string (never leak a raw `{{token}}` to a customer).
 */
export function renderVars(text: string, vars: MergeVars): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_m, name: string) => {
    const key = name.toLowerCase() as MergeVar;
    return vars[key] ?? "";
  });
}

/**
 * Pick the single channel to deliver on: the first in `priority` the recipient
 * is reachable on AND has not opted out of. Returns null when none qualifies
 * (→ a `skipped` ledger row). "Fallback" = reachability at send-time, not
 * runtime failure-retry.
 */
export function resolveChannel(
  priority: readonly CampaignChannel[],
  reachable: ReadonlySet<CampaignChannel>,
  optedOut: ReadonlySet<CampaignChannel>,
): CampaignChannel | null {
  for (const c of priority) {
    if (reachable.has(c) && !optedOut.has(c)) return c;
  }
  return null;
}

/** Attribution window for the "Canjeados" funnel stage. */
export const ATTRIBUTION_WINDOW_DAYS = 14;

/**
 * Count distinct recipients who redeemed the linked offer within the
 * attribution window after their send. Pure so it's unit-testable; the repo
 * feeds it the sent times + the offer's redemptions.
 */
export function countRedeemed(
  sentAtByCustomer: ReadonlyMap<string, Date>,
  redemptions: ReadonlyArray<{ customerId: string; at: Date }>,
  windowMs: number,
): number {
  const redeemed = new Set<string>();
  for (const r of redemptions) {
    if (redeemed.has(r.customerId)) continue;
    const sentAt = sentAtByCustomer.get(r.customerId);
    if (!sentAt) continue;
    const delta = r.at.getTime() - sentAt.getTime();
    if (delta >= 0 && delta <= windowMs) redeemed.add(r.customerId);
  }
  return redeemed.size;
}

/** Whether the message has any content for the given channel. */
export function hasChannelContent(
  message: CampaignMessage | null | undefined,
  c: CampaignChannel,
): boolean {
  if (!message) return false;
  if (c === "push") return !!message.push?.title && !!message.push?.body;
  if (c === "email") return !!message.email?.subject && !!message.email?.body;
  if (c === "sms") return !!message.sms?.text;
  return !!message.whatsapp?.text;
}

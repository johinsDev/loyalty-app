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
export const MERGE_VARS = ["nombre", "nivel", "puntos", "sucursal"] as const;
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

/** Operating timezone for quiet-hours + stat buckets (single-location pilot). */
export const ORG_TZ = "America/Bogota";

/** Parse "HH:mm" → minutes of day, or null if malformed. */
export function parseHhMm(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/**
 * Minutes to defer a non-critical send that lands inside the quiet-hours
 * window, or null if `nowMin` is outside it. Handles overnight windows
 * (start > end, e.g. 21:00→09:00). Pure, so it's unit-testable.
 */
export function minutesUntilQuietEnd(
  nowMin: number,
  startMin: number,
  endMin: number,
): number | null {
  const overnight = startMin > endMin;
  const inWindow = overnight
    ? nowMin >= startMin || nowMin < endMin
    : nowMin >= startMin && nowMin < endMin;
  if (!inWindow) return null;
  // If we're in the pre-midnight leg of an overnight window, the end is tomorrow.
  const end = overnight && nowMin >= startMin ? endMin + 1440 : endMin;
  const diff = end - nowMin;
  return diff <= 0 ? diff + 1440 : diff;
}

/**
 * Count distinct recipients who redeemed the linked offer within the
 * attribution window after their send. Pure so it's unit-testable; the repo
 * feeds it the sent times + the offer's redemptions.
 */
/**
 * The first qualifying redemption date per distinct customer — a redemption
 * counts if it falls within `[sentAt, sentAt + window]`. Returns the dates so
 * callers can both count and bucket them by day.
 */
export function attributedRedemptions(
  sentAtByCustomer: ReadonlyMap<string, Date>,
  redemptions: ReadonlyArray<{ customerId: string; at: Date }>,
  windowMs: number,
): Date[] {
  const seen = new Set<string>();
  const out: Date[] = [];
  for (const r of redemptions) {
    if (seen.has(r.customerId)) continue;
    const sentAt = sentAtByCustomer.get(r.customerId);
    if (!sentAt) continue;
    const delta = r.at.getTime() - sentAt.getTime();
    if (delta >= 0 && delta <= windowMs) {
      seen.add(r.customerId);
      out.push(r.at);
    }
  }
  return out;
}

export function countRedeemed(
  sentAtByCustomer: ReadonlyMap<string, Date>,
  redemptions: ReadonlyArray<{ customerId: string; at: Date }>,
  windowMs: number,
): number {
  return attributedRedemptions(sentAtByCustomer, redemptions, windowMs).length;
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

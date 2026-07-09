import type { db as Db } from "@loyalty/db";
import { campaignSend, shortlink, shortlinkClick } from "@loyalty/db/schema";
import { and, desc, eq, gte, isNotNull } from "drizzle-orm";

/**
 * Marketing attribution for a register sale. The cashier records the sale, not
 * the customer clicking a banner — so we infer the entry source from the
 * customer's own recent engagement: a shortlink click (strongest intent) or a
 * campaign send within a window. Falls back to "organic".
 *
 * Banners have no per-customer tracking today, so they never attribute here.
 * Writes are best-effort context (`entrySource` + `metadata` on the purchase);
 * nothing here blocks or fails the sale.
 */
const WINDOW_MS = 72 * 60 * 60 * 1000;

export type EntrySource = "campaign" | "shortlink" | "organic";

export interface Attribution {
  entrySource: EntrySource;
  metadata: Record<string, unknown> | null;
}

export async function resolveAttribution(
  db: typeof Db,
  args: { orgId: string; customerId: string; now?: Date },
): Promise<Attribution> {
  const now = args.now ?? new Date();
  const since = new Date(now.getTime() - WINDOW_MS);

  // 1. Most recent shortlink click by this customer (engagement beats delivery).
  const clicks = await db
    .select({
      campaignId: shortlink.campaignId,
      shortlinkId: shortlink.id,
      clickId: shortlinkClick.id,
      at: shortlinkClick.clickedAt,
    })
    .from(shortlinkClick)
    .innerJoin(shortlink, eq(shortlinkClick.shortlinkId, shortlink.id))
    .where(
      and(
        eq(shortlink.organizationId, args.orgId),
        eq(shortlink.customerId, args.customerId),
        gte(shortlinkClick.clickedAt, since),
      ),
    )
    .orderBy(desc(shortlinkClick.clickedAt))
    .limit(1);
  const click = clicks[0];
  if (click) {
    return {
      entrySource: click.campaignId ? "campaign" : "shortlink",
      metadata: {
        source: click.campaignId ? "campaign" : "shortlink",
        signal: "click",
        campaignId: click.campaignId ?? undefined,
        shortlinkId: click.shortlinkId,
        clickId: click.clickId,
        at: click.at.toISOString(),
      },
    };
  }

  // 2. Most recent campaign send actually delivered to this customer.
  const sends = await db
    .select({ campaignId: campaignSend.campaignId, sendId: campaignSend.id, at: campaignSend.sentAt })
    .from(campaignSend)
    .where(
      and(
        eq(campaignSend.organizationId, args.orgId),
        eq(campaignSend.customerId, args.customerId),
        isNotNull(campaignSend.sentAt),
        gte(campaignSend.sentAt, since),
      ),
    )
    .orderBy(desc(campaignSend.sentAt))
    .limit(1);
  const send = sends[0];
  if (send) {
    return {
      entrySource: "campaign",
      metadata: {
        source: "campaign",
        signal: "send",
        campaignId: send.campaignId,
        sendId: send.sendId,
        at: send.at ? send.at.toISOString() : undefined,
      },
    };
  }

  // 3. No signal → organic.
  return { entrySource: "organic", metadata: { source: "organic" } };
}

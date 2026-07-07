/**
 * Seeds demo campaigns + a realistic delivery ledger so the whole analytics flow
 * has data: sent (`campaign_send`) spread over the last ~5 weeks, clicks
 * (`shortlink` + `shortlink_click`), and attributed redemptions (`redemption`,
 * within the 14-day window) — across once / evergreen / drip modes, with and
 * without a linked reward offer. Idempotent: clears the org's campaigns, its
 * `sc-*` shortlinks, and its card-less seeded redemptions first.
 *
 *   DATABASE_URL='http://localhost:8080' bun run --cwd packages/db src/seed-campaigns.ts
 *
 * Requires org + owner + customers + rewards (db:seed:org / :owner / :rewards).
 */
/* eslint-disable no-await-in-loop, no-console */
import { and, eq, inArray, isNull, like } from "drizzle-orm";

import { db, getPrimaryOrganizationId } from "./index";
import type { CampaignMessage } from "./schema";
import {
  campaign,
  campaignSend,
  customer,
  member,
  redemption,
  reward,
  shortlink,
  shortlinkClick,
  store,
} from "./schema";

const org = await getPrimaryOrganizationId();
if (!org) throw new Error("no primary organization (run db:seed:org first)");

const [owner] = await db.select().from(member).where(eq(member.organizationId, org)).limit(1);
if (!owner) throw new Error("no member for org (run db:seed:owner first)");
const userId = owner.userId;

const custs = (
  await db.select({ id: customer.id }).from(customer).where(eq(customer.organizationId, org)).limit(8)
).map((c) => c.id);
if (custs.length === 0) throw new Error("no customers for org");

const [rewardRow] = await db
  .select({ id: reward.id })
  .from(reward)
  .where(eq(reward.organizationId, org))
  .limit(1);
const rewardId = rewardRow?.id ?? null;

const [storeRow] = await db.select({ id: store.id }).from(store).where(eq(store.organizationId, org)).limit(1);
const storeId = storeRow?.id ?? null;

const DAY = 86_400_000;
const now = Date.now();
const ago = (days: number, hour = 12): Date =>
  new Date(now - days * DAY + (hour - 12) * 3_600_000);

type Send = { c: number; ch: string; days: number; clicked?: boolean };
type Redeem = { c: number; days: number };
type Seed = {
  name: string;
  mode: "once" | "evergreen" | "drip";
  offer?: boolean;
  message: CampaignMessage;
  channels: string[];
  publishedDays: number;
  cooldownDays?: number;
  drip?: { intervalDays: number; maxAttempts: number };
  sends: Send[];
  redemptions?: Redeem[];
};

const seeds: Seed[] = [
  {
    name: "2×1 lunes",
    mode: "once",
    offer: true,
    message: { push: { title: "🧋 2×1 todos los lunes", body: "Trae a un amigo." } },
    channels: ["push", "email", "whatsapp"],
    publishedDays: 35,
    sends: [
      { c: 0, ch: "push", days: 35, clicked: true },
      { c: 1, ch: "push", days: 35 },
      { c: 2, ch: "whatsapp", days: 35, clicked: true },
      { c: 3, ch: "email", days: 35 },
      { c: 4, ch: "push", days: 35 },
    ],
    redemptions: [
      { c: 0, days: 30 },
      { c: 1, days: 27 },
    ],
  },
  {
    name: "Bienvenida",
    mode: "once",
    message: { email: { subject: "Bienvenido a T4 🎉", body: "Nos alegra tenerte." } },
    channels: ["email", "push"],
    publishedDays: 28,
    sends: [
      { c: 0, ch: "email", days: 28, clicked: true },
      { c: 1, ch: "email", days: 28, clicked: true },
      { c: 2, ch: "push", days: 28 },
      { c: 3, ch: "email", days: 28, clicked: true },
      { c: 4, ch: "push", days: 28 },
    ],
  },
  {
    name: "Te extrañamos",
    mode: "evergreen",
    cooldownDays: 30,
    message: { whatsapp: { text: "Te extrañamos 💚 Vuelve por tu bebida favorita." } },
    channels: ["whatsapp", "push"],
    publishedDays: 24,
    sends: [
      { c: 0, ch: "whatsapp", days: 21, clicked: true },
      { c: 1, ch: "whatsapp", days: 21 },
      { c: 2, ch: "push", days: 14, clicked: true },
      { c: 3, ch: "whatsapp", days: 14 },
      { c: 4, ch: "whatsapp", days: 7 },
      { c: 0, ch: "push", days: 6, clicked: true },
    ],
  },
  {
    name: "Insiste 2×1",
    mode: "drip",
    offer: true,
    drip: { intervalDays: 3, maxAttempts: 3 },
    message: { push: { title: "¿Te lo perdiste? 🧋", body: "Sigue disponible el 2×1." } },
    channels: ["push"],
    publishedDays: 12,
    sends: [
      // attempt 1 (all 5)
      { c: 0, ch: "push", days: 12, clicked: true },
      { c: 1, ch: "push", days: 12 },
      { c: 2, ch: "push", days: 12 },
      { c: 3, ch: "push", days: 12 },
      { c: 4, ch: "push", days: 12 },
      // attempt 2 (non-buyers)
      { c: 1, ch: "push", days: 9, clicked: true },
      { c: 2, ch: "push", days: 9 },
      { c: 3, ch: "push", days: 9 },
      // attempt 3
      { c: 3, ch: "push", days: 6 },
    ],
    redemptions: [
      { c: 0, days: 10 }, // converted after attempt 1
      { c: 1, days: 4 }, // converted after attempt 2
    ],
  },
  {
    name: "Fin de semana",
    mode: "once",
    message: { push: { title: "Plan de fin de semana 🎉", body: "Arranca el finde con T4." } },
    channels: ["push", "sms"],
    publishedDays: 5,
    sends: [
      { c: 0, ch: "push", days: 5, clicked: true },
      { c: 1, ch: "sms", days: 5 },
      { c: 2, ch: "push", days: 5 },
      { c: 3, ch: "push", days: 5 },
      { c: 4, ch: "push", days: 5, clicked: true },
    ],
  },
];

// ── Idempotent cleanup ───────────────────────────────────────────────────────
const existing = await db.select({ id: campaign.id }).from(campaign).where(eq(campaign.organizationId, org));
if (existing.length > 0) {
  await db.delete(campaign).where(inArray(campaign.id, existing.map((r) => r.id)));
}
const seededLinks = await db
  .select({ id: shortlink.id })
  .from(shortlink)
  .where(and(eq(shortlink.organizationId, org), like(shortlink.slug, "sc-%")));
if (seededLinks.length > 0) {
  await db.delete(shortlink).where(inArray(shortlink.id, seededLinks.map((r) => r.id)));
}
// Only our card-less seeded redemptions (real claims carry a card).
await db
  .delete(redemption)
  .where(and(eq(redemption.organizationId, org), isNull(redemption.cardId)));

// ── Insert ───────────────────────────────────────────────────────────────────
let totalSends = 0;
let totalClicks = 0;
let totalRedemptions = 0;

for (const [ci, s] of seeds.entries()) {
  const evergreenOrDrip = s.mode === "evergreen" || s.mode === "drip";
  const offer = s.offer && rewardId ? { kind: "reward" as const, id: rewardId } : null;
  const [row] = await db
    .insert(campaign)
    .values({
      organizationId: org,
      createdByUserId: userId,
      type: "promotional",
      status: "published",
      publishedAt: ago(s.publishedDays),
      createdAt: ago(s.publishedDays + 1),
      name: s.name,
      message: s.message,
      channelPriority: s.channels,
      offer,
      mode: s.mode,
      cooldownDays: s.cooldownDays ?? null,
      dripIntervalDays: s.drip?.intervalDays ?? null,
      dripMaxAttempts: s.drip?.maxAttempts ?? null,
      sendState: evergreenOrDrip ? "active" : "sent",
      sentAt: evergreenOrDrip ? null : ago(s.publishedDays),
      activatedAt: evergreenOrDrip ? ago(s.publishedDays) : null,
      lastPulseAt: evergreenOrDrip ? ago(s.sends[s.sends.length - 1]!.days) : null,
    })
    .returning({ id: campaign.id });
  const campId = row!.id;

  for (const [si, snd] of s.sends.entries()) {
    const customerId = custs[snd.c % custs.length]!;
    await db.insert(campaignSend).values({
      organizationId: org,
      campaignId: campId,
      customerId,
      channel: snd.ch,
      status: "sent",
      sentAt: ago(snd.days, 10),
      createdAt: ago(snd.days, 10),
    });
    totalSends += 1;

    if (snd.clicked) {
      const [link] = await db
        .insert(shortlink)
        .values({
          organizationId: org,
          slug: `sc-${ci}-${si}`,
          targetUrl: "/promos",
          createdByUserId: userId,
          campaignId: campId,
          customerId,
          clickCount: 1,
          createdAt: ago(snd.days, 10),
        })
        .returning({ id: shortlink.id });
      await db.insert(shortlinkClick).values({
        shortlinkId: link!.id,
        clickedAt: ago(snd.days - 1, 14),
      });
      totalClicks += 1;
    }
  }

  for (const r of s.redemptions ?? []) {
    if (!rewardId) continue;
    await db.insert(redemption).values({
      organizationId: org,
      customerId: custs[r.c % custs.length]!,
      rewardId,
      redeemedByUserId: userId,
      currency: "COP",
      storeId,
      createdAt: ago(r.days, 15),
    });
    totalRedemptions += 1;
  }
}

console.log(
  `seeded ${seeds.length} campaigns · ${totalSends} sends · ${totalClicks} clicks · ${totalRedemptions} redemptions`,
);
process.exit(0);

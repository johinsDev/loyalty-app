import {
  CampaignsRepository,
  ORG_TZ,
  entityRefs,
  hasChannelContent,
  minutesUntilQuietEnd,
  parseHhMm,
  renderTemplate,
  resolveChannel,
  toNotificationChannel,
  type CampaignChannel,
  type Token,
} from "@loyalty/api/features/campaigns";
import { db } from "@loyalty/db";
import type { CampaignMessage } from "@loyalty/db/schema";
import { logger, task, tasks } from "@trigger.dev/sdk/v3";

import { env } from "../env";
import { notifier } from "../notifications";
import { CampaignNotification } from "../notifications-registry";
import { shortlinks } from "../shortlinks";

/** Current minutes-of-day in the org timezone (0–1439). */
function orgNowMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ORG_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hh * 60 + mm;
}

// Untyped at the boundary (api enqueues this by id to avoid an api → jobs
// cycle). Stays in sync with packages/api/src/features/campaigns/service.ts.
type Payload = {
  organizationId: string;
  campaignId: string;
  onlyCustomerIds?: string[];
};

type Resolve = (token: Token) => string | Promise<string>;

/** Build the pre-rendered, single-channel content for a recipient. */
async function renderContent(
  channel: CampaignChannel,
  message: CampaignMessage,
  resolve: Resolve,
) {
  const r = (s: string) => renderTemplate(s, resolve);
  if (channel === "push" && message.push) {
    return { push: { title: await r(message.push.title), body: await r(message.push.body) } };
  }
  if (channel === "email" && message.email) {
    // The email body is rich HTML from the wizard editor; render tokens into it
    // as-is (no extra wrapping).
    return { mail: { subject: await r(message.email.subject), html: await r(message.email.body) } };
  }
  if (channel === "sms" && message.sms) {
    return { sms: { body: await r(message.sms.text) } };
  }
  if (channel === "whatsapp" && message.whatsapp) {
    return { whatsapp: { body: await r(message.whatsapp.text) } };
  }
  return {};
}

/**
 * Delivers a promotional campaign. Resolves the audience at fire time (inline
 * filters), picks ONE channel per recipient by reachability + opt-out priority,
 * renders the per-channel copy with merge vars, and fans out through the
 * Notifier — writing one `campaign_send` ledger row per recipient (the funnel's
 * "Enviados" + failure control backbone).
 */
export const sendCampaignTask = task({
  id: "send-campaign",
  maxDuration: 300,
  run: async (p: Payload) => {
    const repo = new CampaignsRepository(db);
    const campaign = await repo.findById(p.organizationId, p.campaignId);
    if (!campaign) {
      logger.error("send-campaign: campaign not found", { campaignId: p.campaignId });
      return { recipients: 0, error: "campaign-not-found" };
    }
    if (campaign.pausedAt) {
      logger.info("send-campaign: paused, skipping", { campaignId: p.campaignId });
      return { recipients: 0, paused: true };
    }

    const message = campaign.message;
    const priority = (campaign.channelPriority ?? []) as CampaignChannel[];
    if (!message || priority.length === 0) {
      logger.error("send-campaign: incomplete campaign", { campaignId: p.campaignId });
      return { recipients: 0, error: "incomplete" };
    }

    // Only channels the campaign actually has copy for are deliverable.
    const effectivePriority = priority.filter((c) => hasChannelContent(message, c));

    // ── Smart Delivery: quiet hours (defer the whole send) + frequency cap ──
    const rules = await repo.getSmartDelivery(p.organizationId);
    const quietStart = parseHhMm(rules?.quietHoursStart);
    const quietEnd = parseHhMm(rules?.quietHoursEnd);
    if (quietStart != null && quietEnd != null) {
      const deferMin = minutesUntilQuietEnd(orgNowMinutes(), quietStart, quietEnd);
      if (deferMin != null && deferMin > 0) {
        // Re-enqueue at the window's end (+1min buffer). Transactional sends
        // never hit this path; promotional/automated always respect quiet hours.
        const runAt = new Date(Date.now() + (deferMin + 1) * 60_000);
        const handle = await tasks.trigger("send-campaign", p, { delay: runAt });
        await repo.setRun(p.campaignId, handle.id);
        await repo.setSendState(p.campaignId, "scheduled");
        logger.info("send-campaign: deferred for quiet hours", {
          campaignId: campaign.id,
          runAt: runAt.toISOString(),
        });
        return { recipients: 0, deferred: true };
      }
    }
    // Frequency cap: promotional-only, rolling 7 days; "Especial" bypasses it.
    const cap = campaign.special ? null : (rules?.frequencyCapPerWeek ?? null);
    const capSince = new Date(Date.now() - 7 * 86_400_000);

    await repo.setSendState(p.campaignId, "sending");

    let recipients = await repo.resolveRecipients(p.organizationId, campaign.audienceFilter);
    if (p.onlyCustomerIds) {
      const only = new Set(p.onlyCustomerIds);
      recipients = recipients.filter((r) => only.has(r.customerId));
    }

    logger.info("send-campaign start", {
      campaignId: campaign.id,
      recipients: recipients.length,
      priority: effectivePriority,
    });

    // Resolve template entities once (same for every recipient) + shortlink/URL
    // helpers for `.href` and the legacy `{{short_link}}`.
    const allTexts = [
      message.push?.title,
      message.push?.body,
      message.email?.subject,
      message.email?.body,
      message.sms?.text,
      message.whatsapp?.text,
    ].filter((s): s is string => !!s);
    const [entityMap, storeName] = await Promise.all([
      repo.resolveEntityRefs(p.organizationId, entityRefs(...allTexts)),
      repo.storeName(p.organizationId),
    ]);
    const appBase = env.CUSTOMER_APP_URL?.replace(/\/+$/, "") ?? "";
    const absolute = (url: string) =>
      /^https?:\/\//i.test(url) ? url : appBase ? `${appBase}${url}` : url;
    const shorten = async (url: string, customerId: string) => {
      try {
        const res = await shortlinks.shorten(url, {
          organizationId: p.organizationId,
          campaignId: campaign.id,
          customerId,
        });
        return res.shortUrl;
      } catch {
        return url;
      }
    };

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const r of recipients) {
      // Frequency cap: skip recipients already at the rolling-7-day limit.
      if (cap != null) {
        const recent = await repo.recentSendCount(p.organizationId, r.customerId, capSince);
        if (recent >= cap) {
          await repo.recordSend({
            organizationId: p.organizationId,
            campaignId: campaign.id,
            customerId: r.customerId,
            channel: null,
            status: "skipped",
            skipReason: "capped",
          });
          skipped += 1;
          continue;
        }
      }

      const reachable = new Set(r.reachable);
      const optedOut = new Set(r.optedOut);
      const channel = resolveChannel(effectivePriority, reachable, optedOut);

      if (!channel) {
        // Distinguish "no deliverable channel at all" from "all opted out".
        const reachableInPriority = effectivePriority.filter((c) => reachable.has(c));
        const reason = reachableInPriority.length === 0 ? "no-channel" : "opted-out";
        await repo.recordSend({
          organizationId: p.organizationId,
          campaignId: campaign.id,
          customerId: r.customerId,
          channel: null,
          status: "skipped",
          skipReason: reason,
        });
        skipped += 1;
        continue;
      }

      // Per-recipient token resolver: user.* (dynamic), store.*, entity refs
      // (fixed), and `.href`/`{{short_link}}` → per-recipient tracked shortlink.
      const resolve: Resolve = async (tk) => {
        if (tk.scope === "user") {
          if (tk.field === "name") return r.name ?? "";
          if (tk.field === "tier") return r.tier ?? "";
          if (tk.field === "short_link")
            return campaign.linkUrl ? shorten(absolute(campaign.linkUrl), r.customerId) : "";
          return ""; // user.points — deferred
        }
        if (tk.scope === "store") return tk.field === "name" ? storeName : "";
        const ent = entityMap.get(`${tk.scope}#${tk.id}`);
        if (!ent) return "";
        if (tk.field === "name") return ent.name;
        if (tk.field === "href") return ent.url ? shorten(absolute(ent.url), r.customerId) : "";
        return "";
      };
      const content = await renderContent(channel, message, resolve);

      try {
        const result = await notifier.send(
          { customerId: r.customerId, organizationId: p.organizationId },
          new CampaignNotification(toNotificationChannel(channel), content),
        );
        const outcome = result.results[0];
        if (outcome?.status === "sent") {
          await repo.recordSend({
            organizationId: p.organizationId,
            campaignId: campaign.id,
            customerId: r.customerId,
            channel,
            status: "sent",
            sentAt: new Date(),
          });
          sent += 1;
        } else if (outcome?.status === "skipped") {
          await repo.recordSend({
            organizationId: p.organizationId,
            campaignId: campaign.id,
            customerId: r.customerId,
            channel,
            status: "skipped",
            skipReason: outcome.reason ?? "opted-out",
          });
          skipped += 1;
        } else {
          await repo.recordSend({
            organizationId: p.organizationId,
            campaignId: campaign.id,
            customerId: r.customerId,
            channel,
            status: "failed",
            error: outcome?.error?.message ?? "unknown",
          });
          failed += 1;
        }
      } catch (error) {
        await repo.recordSend({
          organizationId: p.organizationId,
          campaignId: campaign.id,
          customerId: r.customerId,
          channel,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
        failed += 1;
      }
    }

    await repo.setSendState(p.campaignId, "sent", { sentAt: new Date() });
    const output = { recipients: recipients.length, sent, skipped, failed };
    logger.info("send-campaign done", output);
    return output;
  },
});

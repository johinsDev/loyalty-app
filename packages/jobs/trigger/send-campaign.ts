import {
  CampaignsRepository,
  ORG_TZ,
  hasChannelContent,
  minutesUntilQuietEnd,
  parseHhMm,
  renderVars,
  resolveChannel,
  toNotificationChannel,
  type CampaignChannel,
  type MergeVars,
} from "@loyalty/api/features/campaigns";
import { db } from "@loyalty/db";
import type { CampaignMessage } from "@loyalty/db/schema";
import { logger, task, tasks } from "@trigger.dev/sdk/v3";

import { notifier } from "../notifications";
import { CampaignNotification } from "../notifications-registry";
import { shortlinks } from "../shortlinks";

const SHORT_LINK_TOKEN = /\{\{\s*short_link\s*\}\}/i;

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

/** Concatenated raw copy for a channel, to detect the `{{short_link}}` token. */
function channelText(channel: CampaignChannel, message: CampaignMessage): string {
  if (channel === "push") return `${message.push?.title ?? ""} ${message.push?.body ?? ""}`;
  if (channel === "email") return `${message.email?.subject ?? ""} ${message.email?.body ?? ""}`;
  if (channel === "sms") return message.sms?.text ?? "";
  return message.whatsapp?.text ?? "";
}

// Untyped at the boundary (api enqueues this by id to avoid an api → jobs
// cycle). Stays in sync with packages/api/src/features/campaigns/service.ts.
type Payload = {
  organizationId: string;
  campaignId: string;
  onlyCustomerIds?: string[];
};

/** Build the pre-rendered, single-channel content for a recipient. */
function renderContent(
  channel: CampaignChannel,
  message: CampaignMessage,
  vars: MergeVars,
) {
  if (channel === "push" && message.push) {
    return {
      push: {
        title: renderVars(message.push.title, vars),
        body: renderVars(message.push.body, vars),
      },
    };
  }
  if (channel === "email" && message.email) {
    // The email body is rich HTML from the wizard editor; render vars into it
    // as-is (no extra wrapping).
    return {
      mail: {
        subject: renderVars(message.email.subject, vars),
        html: renderVars(message.email.body, vars),
      },
    };
  }
  if (channel === "sms" && message.sms) {
    return { sms: { body: renderVars(message.sms.text, vars) } };
  }
  if (channel === "whatsapp" && message.whatsapp) {
    return { whatsapp: { body: renderVars(message.whatsapp.text, vars) } };
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

      // Resolve `{{short_link}}`: mint a per-recipient shortlink (attributed to
      // campaign+customer) only when this channel's copy uses the token and the
      // campaign has a CTA URL. Null provider (dev) returns the raw URL.
      let shortLink = campaign.linkUrl ?? "";
      if (campaign.linkUrl && SHORT_LINK_TOKEN.test(channelText(channel, message))) {
        try {
          const res = await shortlinks.shorten(campaign.linkUrl, {
            organizationId: p.organizationId,
            campaignId: campaign.id,
            customerId: r.customerId,
          });
          shortLink = res.shortUrl;
        } catch {
          shortLink = campaign.linkUrl;
        }
      }

      const vars: MergeVars = {
        nombre: r.name ?? "",
        nivel: r.tier ?? "",
        puntos: "",
        sucursal: "",
        short_link: shortLink,
      };
      const content = renderContent(channel, message, vars);

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

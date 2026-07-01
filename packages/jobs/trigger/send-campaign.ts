import {
  CampaignsRepository,
  hasChannelContent,
  renderVars,
  resolveChannel,
  toNotificationChannel,
  type CampaignChannel,
  type MergeVars,
} from "@loyalty/api/features/campaigns";
import { db } from "@loyalty/db";
import type { CampaignMessage } from "@loyalty/db/schema";
import { logger, task } from "@trigger.dev/sdk/v3";

import { notifier } from "../notifications";
import { CampaignNotification } from "../notifications-registry";

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
    return {
      mail: {
        subject: renderVars(message.email.subject, vars),
        html: `<p>${renderVars(message.email.body, vars)}</p>`,
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

      const vars: MergeVars = {
        nombre: r.name ?? "",
        nivel: r.tier ?? "",
        puntos: "",
        sucursal: "",
        short_link: "",
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

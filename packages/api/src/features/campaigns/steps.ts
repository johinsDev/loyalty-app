import type { CampaignAudienceFilter, CampaignRow } from "@loyalty/db/schema";

import { WizardStep, type WizardContext } from "../_shared/wizard";
import { hasChannelContent } from "./message";
import type { CampaignsRepository } from "./repository";
import {
  audienceFilterSchema,
  definitionStepSchema,
  messageStepSchema,
  scheduleStepSchema,
  type AudienceStepInput,
  type DefinitionStepInput,
  type MessageStepInput,
  type ScheduleStepInput,
} from "./schemas";

export interface CampaignStepServices {
  repo: CampaignsRepository;
}
type Ctx = WizardContext<CampaignStepServices>;

export class DefinitionStep extends WizardStep<
  CampaignRow,
  DefinitionStepInput,
  CampaignStepServices
> {
  readonly key = "definition";
  readonly schema = definitionStepSchema;
  isComplete(d: CampaignRow) {
    return d.name != null && d.name !== "";
  }
  persist(ctx: Ctx, d: CampaignRow, input: DefinitionStepInput) {
    return ctx.services.repo.patch(ctx.organizationId, d.id, {
      name: input.name,
      objective: input.objective ?? null,
    });
  }
}

export class MessageStep extends WizardStep<
  CampaignRow,
  MessageStepInput,
  CampaignStepServices
> {
  readonly key = "message";
  readonly schema = messageStepSchema;
  isComplete(d: CampaignRow) {
    const hasContent =
      hasChannelContent(d.message, "push") ||
      hasChannelContent(d.message, "email") ||
      hasChannelContent(d.message, "sms") ||
      hasChannelContent(d.message, "whatsapp");
    return hasContent && (d.channelPriority?.length ?? 0) > 0;
  }
  persist(ctx: Ctx, d: CampaignRow, input: MessageStepInput) {
    const { linkUrl, channelPriority, ...message } = input;
    return ctx.services.repo.patch(ctx.organizationId, d.id, {
      message,
      channelPriority,
      linkUrl: linkUrl?.trim() ? linkUrl.trim() : null,
    });
  }
}

export class AudienceStep extends WizardStep<
  CampaignRow,
  AudienceStepInput,
  CampaignStepServices
> {
  readonly key = "audience";
  readonly schema = audienceFilterSchema;
  // Optional — an empty filter targets everyone, so it never blocks publish.
  isComplete(_d: CampaignRow) {
    return true;
  }
  persist(ctx: Ctx, d: CampaignRow, input: AudienceStepInput) {
    // Store dates as epoch ms so the JSON column + send job stay Date-free.
    const filter: CampaignAudienceFilter = {
      ...(input.tiers?.length ? { tiers: input.tiers } : {}),
      ...(input.lastPurchase ? { lastPurchase: input.lastPurchase } : {}),
      ...(input.minPurchases != null ? { minPurchases: input.minPurchases } : {}),
      ...(input.signedUpAfter
        ? { signedUpAfter: input.signedUpAfter.getTime() }
        : {}),
      ...(input.signedUpBefore
        ? { signedUpBefore: input.signedUpBefore.getTime() }
        : {}),
    };
    return ctx.services.repo.patch(ctx.organizationId, d.id, {
      audienceFilter: Object.keys(filter).length ? filter : null,
    });
  }
}

export class ScheduleStep extends WizardStep<
  CampaignRow,
  ScheduleStepInput,
  CampaignStepServices
> {
  readonly key = "schedule";
  readonly schema = scheduleStepSchema;
  // Optional — no schedule means "send now on publish".
  isComplete(_d: CampaignRow) {
    return true;
  }
  persist(ctx: Ctx, d: CampaignRow, input: ScheduleStepInput) {
    const mode = input.mode ?? "once";
    const evergreen = mode === "evergreen";
    const drip = mode === "drip";
    return ctx.services.repo.patch(ctx.organizationId, d.id, {
      mode,
      // Recurring modes ignore a one-shot schedule; once ignores their params.
      scheduledAt: evergreen || drip ? null : (input.scheduledAt ?? null),
      special: input.special ?? false,
      cooldownDays: evergreen ? (input.cooldownDays ?? null) : null,
      endsAt: evergreen ? (input.endsAt ?? null) : null,
      dripIntervalDays: drip ? (input.dripIntervalDays ?? 3) : null,
      dripMaxAttempts: drip ? (input.dripMaxAttempts ?? 3) : null,
    });
  }
}

import type { db as Db } from "@loyalty/db";
import type { CampaignRow } from "@loyalty/db/schema";
import { runs, tasks } from "@trigger.dev/sdk/v3";
import { TRPCError } from "@trpc/server";

import type { ListResult } from "../_shared/list";
import type { WizardState } from "../_shared/wizard";
import {
  CAMPAIGN_CHANNELS,
  resolveChannel,
  type CampaignChannel,
} from "./message";
import { CampaignsRepository, displayState } from "./repository";
import type {
  CampaignFunnel,
  CampaignListItem,
  CampaignReach,
  CampaignStepKey,
  CampaignsListInput,
  CountReachInput,
  RenderPreviewInput,
  RenderedPreview,
} from "./schemas";
import { entityRefs, renderTemplate, type Token } from "./templating";
import { campaignWizard } from "./wizard";

// Untyped trigger payload — typing it would make @loyalty/api depend on
// @loyalty/jobs (which already depends on api → cycle). Stays in sync with
// packages/jobs/trigger/send-campaign.ts.
type SendCampaignPayload = {
  organizationId: string;
  campaignId: string;
  /** When set, only (re)send to these recipients — used by "Reintentar". */
  onlyCustomerIds?: string[];
};

export interface CampaignStateResult {
  campaign: CampaignRow;
  state: WizardState;
}

export class CampaignsService {
  constructor(
    private readonly db: typeof Db,
    private readonly repo: CampaignsRepository,
  ) {}

  // ── Wizard ──────────────────────────────────────────────────────────────
  async create(orgId: string, userId: string): Promise<CampaignStateResult> {
    const row = await this.repo.createDraft(orgId, userId);
    return { campaign: row, state: campaignWizard.state(row) };
  }

  async getState(orgId: string, id: string): Promise<CampaignStateResult> {
    const row = await this.loadDraft(orgId, id);
    return { campaign: row, state: campaignWizard.state(row) };
  }

  async advance(
    orgId: string,
    userId: string,
    id: string,
    step: CampaignStepKey,
    input: unknown,
  ): Promise<CampaignStateResult> {
    const current = await this.loadDraft(orgId, id);
    if (current.status === "published") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Cannot edit a published campaign",
      });
    }
    const { draft, state } = await campaignWizard.advance(
      { db: this.db, organizationId: orgId, userId, services: { repo: this.repo } },
      current,
      step,
      input,
    );
    return { campaign: draft, state };
  }

  async publish(orgId: string, id: string): Promise<CampaignStateResult> {
    const current = await this.loadDraft(orgId, id);
    if (current.status === "published") {
      return { campaign: current, state: campaignWizard.state(current) };
    }
    const state = campaignWizard.state(current);
    if (!state.canPublish) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Completa definición, mensaje y canales antes de publicar",
      });
    }
    const published = await this.repo.markPublished(orgId, id, {
      scheduledAt: current.scheduledAt,
      special: current.special,
    });
    await this.enqueue(orgId, published);
    return { campaign: published, state: campaignWizard.state(published) };
  }

  /** Enqueue the dispatch job (native Trigger `delay` for scheduled sends). */
  private async enqueue(
    orgId: string,
    row: CampaignRow,
    onlyCustomerIds?: string[],
  ): Promise<void> {
    const payload: SendCampaignPayload = {
      organizationId: orgId,
      campaignId: row.id,
      ...(onlyCustomerIds ? { onlyCustomerIds } : {}),
    };
    const handle = await tasks.trigger(
      "send-campaign",
      payload,
      row.scheduledAt && row.scheduledAt > new Date()
        ? { delay: row.scheduledAt }
        : undefined,
    );
    await this.repo.setRun(row.id, handle.id);
  }

  // ── List / detail ─────────────────────────────────────────────────────────
  adminList(
    orgId: string,
    input: CampaignsListInput,
  ): Promise<ListResult<CampaignListItem>> {
    return this.repo.adminList(orgId, input);
  }

  listByIds(orgId: string, ids: string[]): Promise<CampaignListItem[]> {
    return this.repo.listByIds(orgId, ids);
  }

  async detail(orgId: string, id: string) {
    const row = await this.loadDraft(orgId, id);
    const [funnel, failures] = await Promise.all([
      this.repo.funnel(orgId, row),
      this.repo.listFailures(orgId, id),
    ]);
    return {
      id: row.id,
      name: row.name ?? "Borrador",
      type: row.type,
      status: row.status,
      displayState: displayState(row),
      objective: row.objective,
      message: row.message,
      linkUrl: row.linkUrl,
      offer: row.offer,
      channelPriority: row.channelPriority ?? [],
      audienceFilter: row.audienceFilter,
      scheduledAt: row.scheduledAt,
      special: row.special,
      sentAt: row.sentAt,
      createdAt: row.createdAt,
      funnel,
      failures,
    };
  }

  async funnel(orgId: string, id: string): Promise<CampaignFunnel> {
    const row = await this.loadDraft(orgId, id);
    return this.repo.funnel(orgId, row);
  }

  // ── Live preview: resolve tokens to sample/real values ────────────────────
  async renderPreview(
    orgId: string,
    input: RenderPreviewInput,
  ): Promise<RenderedPreview> {
    const m = input.message;
    const texts = [
      m.push?.title,
      m.push?.body,
      m.email?.subject,
      m.email?.body,
      m.sms?.text,
      m.whatsapp?.text,
    ].filter((s): s is string => !!s);
    const [entityMap, storeName] = await Promise.all([
      this.repo.resolveEntityRefs(orgId, entityRefs(...texts)),
      this.repo.storeName(orgId),
    ]);
    // Sample values for dynamic vars; real values for bound entities.
    const resolve = (t: Token): string => {
      if (t.scope === "user") {
        if (t.field === "name") return "Ana";
        if (t.field === "tier") return "Oro";
        if (t.field === "points") return "1.200";
        if (t.field === "short_link") return "t4.co/abc";
        return "";
      }
      if (t.scope === "store") return t.field === "name" ? storeName : "";
      const ent = entityMap.get(`${t.scope}#${t.id}`);
      if (!ent) return "";
      if (t.field === "name") return ent.name;
      if (t.field === "href") return `t4.co/${(t.id ?? "").slice(0, 6)}`;
      return "";
    };
    const r = (s: string) => renderTemplate(s, resolve);
    const out: RenderedPreview = {};
    if (m.push) out.push = { title: await r(m.push.title), body: await r(m.push.body) };
    if (m.email) out.email = { subject: await r(m.email.subject), body: await r(m.email.body) };
    if (m.sms) out.sms = { text: await r(m.sms.text) };
    if (m.whatsapp) out.whatsapp = { text: await r(m.whatsapp.text) };
    return out;
  }

  // ── Reach preview ───────────────────────────────────────────────────────────
  async countReach(orgId: string, input: CountReachInput): Promise<CampaignReach> {
    const filter = input.audienceFilter
      ? {
          ...input.audienceFilter,
          signedUpAfter: input.audienceFilter.signedUpAfter?.getTime(),
          signedUpBefore: input.audienceFilter.signedUpBefore?.getTime(),
        }
      : null;
    const recipients = await this.repo.resolveRecipients(orgId, filter);
    const priority = (input.channelPriority?.length
      ? input.channelPriority
      : CAMPAIGN_CHANNELS) as CampaignChannel[];
    const reachable = recipients.filter(
      (r) =>
        resolveChannel(priority, new Set(r.reachable), new Set(r.optedOut)) !== null,
    ).length;
    return { audience: recipients.length, reachable };
  }

  // ── Lifecycle actions ───────────────────────────────────────────────────────
  async pause(orgId: string, id: string): Promise<{ ok: true }> {
    const row = await this.loadDraft(orgId, id);
    if (row.runId && !row.sentAt) {
      await runs.cancel(row.runId).catch(() => undefined);
    }
    await this.repo.pause(orgId, id);
    return { ok: true };
  }

  /** Re-enqueue only the failed recipients; clears their old failed rows first. */
  async retry(orgId: string, id: string): Promise<{ ok: true; recipients: number }> {
    const row = await this.loadDraft(orgId, id);
    const failedIds = await this.repo.failedRecipientIds(orgId, id);
    if (failedIds.length === 0) return { ok: true, recipients: 0 };
    await this.repo.clearSends(id, ["failed"]);
    await this.enqueue(orgId, { ...row, scheduledAt: null }, failedIds);
    return { ok: true, recipients: failedIds.length };
  }

  async remove(orgId: string, id: string): Promise<{ ok: true }> {
    const row = await this.loadDraft(orgId, id);
    if (row.runId && !row.sentAt) {
      await runs.cancel(row.runId).catch(() => undefined);
    }
    await this.repo.remove(orgId, id);
    return { ok: true };
  }

  async bulkRemove(orgId: string, ids: string[]): Promise<{ ok: true }> {
    await this.repo.bulkRemove(orgId, ids);
    return { ok: true };
  }

  private async loadDraft(orgId: string, id: string): Promise<CampaignRow> {
    const row = await this.repo.findById(orgId, id);
    if (!row) {
      throw new TRPCError({ code: "NOT_FOUND", message: `campaign "${id}" not found` });
    }
    return row;
  }
}

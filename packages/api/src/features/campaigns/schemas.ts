import { z } from "zod";

import { listQueryBase } from "../_shared/list";
import { CAMPAIGN_CHANNELS } from "./message";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const campaignTypeSchema = z.enum([
  "promotional",
  "automated",
  "transactional",
]);
export const campaignStatusSchema = z.enum(["draft", "published"]);
export const campaignChannelSchema = z.enum(CAMPAIGN_CHANNELS);
export const tierKeySchema = z.enum(["hoja", "flor", "oro"]);

/** Derived display state for the admin list/funnel (not stored). */
export type CampaignDisplayState =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused";
export const campaignDisplayStateSchema = z.enum([
  "draft",
  "scheduled",
  "sending",
  "sent",
  "paused",
]);

// ─── Per-step input schemas (reused verbatim by the FE forms) ────────────────
/** Optional linked redeemable offer (drives the "Canjeados" funnel stage). */
export const offerSchema = z.object({
  kind: z.enum(["promo", "reward"]),
  id: z.string().min(1),
});
export type OfferInput = z.infer<typeof offerSchema>;

export const definitionStepSchema = z.object({
  name: z.string().min(1).max(120),
  objective: z.string().max(500).optional(),
  offer: offerSchema.nullish(),
});

const pushContentSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(180),
});
const emailContentSchema = z.object({
  subject: z.string().min(1).max(160),
  body: z.string().min(1).max(4000),
});
const smsContentSchema = z.object({ text: z.string().min(1).max(480) });
const whatsappContentSchema = z.object({ text: z.string().min(1).max(1024) });

export const messageStepSchema = z
  .object({
    push: pushContentSchema.optional(),
    email: emailContentSchema.optional(),
    sms: smsContentSchema.optional(),
    whatsapp: whatsappContentSchema.optional(),
    /** CTA destination for `{{short_link}}` (shortened per-recipient at send). */
    linkUrl: z.string().url().optional().or(z.literal("")),
  })
  .refine((m) => !!(m.push || m.email || m.sms || m.whatsapp), {
    message: "Escribe el mensaje para al menos un canal",
  });

export const channelsStepSchema = z.object({
  /** Ordered priority; first reachable channel per recipient wins. */
  channelPriority: z.array(campaignChannelSchema).min(1),
});

export const audienceFilterSchema = z.object({
  tiers: z.array(tierKeySchema).optional(),
  lastPurchase: z
    .object({ op: z.enum(["gte", "lte"]), days: z.number().int().min(0).max(3650) })
    .optional(),
  minPurchases: z.number().int().min(1).max(100000).optional(),
  signedUpAfter: z.coerce.date().optional(),
  signedUpBefore: z.coerce.date().optional(),
});
export type AudienceFilterInput = z.infer<typeof audienceFilterSchema>;

export const scheduleStepSchema = z.object({
  // null/undefined = send now on publish.
  scheduledAt: z.coerce.date().optional(),
  // Smart-delivery bypass ("Especial") — wired in P4.
  special: z.boolean().optional(),
});

export type DefinitionStepInput = z.infer<typeof definitionStepSchema>;
export type MessageStepInput = z.infer<typeof messageStepSchema>;
export type ChannelsStepInput = z.infer<typeof channelsStepSchema>;
export type AudienceStepInput = z.infer<typeof audienceFilterSchema>;
export type ScheduleStepInput = z.infer<typeof scheduleStepSchema>;

export const CAMPAIGN_STEP_KEYS = [
  "definition",
  "message",
  "channels",
  "audience",
  "schedule",
] as const;
export type CampaignStepKey = (typeof CAMPAIGN_STEP_KEYS)[number];

// ─── Admin IO ────────────────────────────────────────────────────────────────
export const getStateInputSchema = z.object({ id: z.string().uuid() });
export const publishInputSchema = z.object({ id: z.string().uuid() });
export const removeInputSchema = z.object({ id: z.string().uuid() });
export const pauseInputSchema = z.object({ id: z.string().uuid() });
export const retryInputSchema = z.object({ id: z.string().uuid() });
export const advanceInputSchema = z.object({
  id: z.string().uuid(),
  step: z.enum(CAMPAIGN_STEP_KEYS),
  input: z.unknown(),
});

export const bulkIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});
export type BulkIdsInput = z.infer<typeof bulkIdsSchema>;

// ─── Admin data-table list (nuqs-driven) ─────────────────────────────────────
export const campaignsListInputSchema = listQueryBase.extend({
  type: z.array(campaignTypeSchema).optional(),
  state: z.array(campaignDisplayStateSchema).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
});
export type CampaignsListInput = z.infer<typeof campaignsListInputSchema>;

/** Lean row for the admin data-table (heavy fields stay out). */
export interface CampaignListItem {
  id: string;
  name: string;
  type: string;
  status: string;
  displayState: CampaignDisplayState;
  channelPriority: string[];
  scheduledAt: Date | null;
  sentAt: Date | null;
  /** Enviados count (from the ledger) — 0 until dispatched. */
  sent: number;
  createdAt: Date;
}

// ─── Reach preview (audience − unreachable/opt-outs) ─────────────────────────
export const countReachInputSchema = z.object({
  audienceFilter: audienceFilterSchema.optional(),
  channelPriority: z.array(campaignChannelSchema).optional(),
});
export type CountReachInput = z.infer<typeof countReachInputSchema>;

export interface CampaignReach {
  /** Everyone the filter targets. */
  audience: number;
  /** Would actually receive it — reachable on a priority channel, not opted out. */
  reachable: number;
}

// ─── Funnel + detail ─────────────────────────────────────────────────────────
export interface CampaignFunnel {
  /** Ledger rows with status = sent. */
  sent: number;
  /** Distinct recipients who clicked a per-recipient `{{short_link}}`. */
  clicked: number;
  /**
   * Distinct recipients who redeemed the linked offer within the attribution
   * window after their send. `null` when the campaign has no linked offer.
   */
  redeemed: number | null;
  /** Recipients skipped (with per-reason breakdown). */
  skipped: number;
  /** Ledger rows with status = failed (retryable). */
  failed: number;
  skipReasons: Record<string, number>;
  /** Per-channel breakdown of successful sends. */
  byChannel: Record<string, number>;
}

export interface CampaignFailureRow {
  id: string;
  customerId: string;
  channel: string | null;
  error: string | null;
  createdAt: Date;
}

// ─── Live preview (resolve tokens to sample/real values) ─────────────────────
export const previewMessageSchema = z.object({
  push: z.object({ title: z.string(), body: z.string() }).optional(),
  email: z.object({ subject: z.string(), body: z.string() }).optional(),
  sms: z.object({ text: z.string() }).optional(),
  whatsapp: z.object({ text: z.string() }).optional(),
});
export const renderPreviewInputSchema = z.object({ message: previewMessageSchema });
export type RenderPreviewInput = z.infer<typeof renderPreviewInputSchema>;

/** Per-channel content with every token resolved to a sample/real value. */
export interface RenderedPreview {
  push?: { title: string; body: string };
  email?: { subject: string; body: string };
  sms?: { text: string };
  whatsapp?: { text: string };
}

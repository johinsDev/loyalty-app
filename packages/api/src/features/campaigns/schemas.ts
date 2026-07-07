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
  | "paused"
  // Evergreen: a live standing rule ("active") or a stopped one ("ended").
  | "active"
  | "ended";
export const campaignDisplayStateSchema = z.enum([
  "draft",
  "scheduled",
  "sending",
  "sent",
  "paused",
  "active",
  "ended",
]);

// ─── Per-step input schemas (reused verbatim by the FE forms) ────────────────
export const definitionStepSchema = z.object({
  name: z.string().min(1).max(120),
  objective: z.string().max(500).optional(),
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

/** Per-channel content (no channel priority) — used for presets + the draft. */
export const messageContentSchema = z.object({
  push: pushContentSchema.optional(),
  email: emailContentSchema.optional(),
  sms: smsContentSchema.optional(),
  whatsapp: whatsappContentSchema.optional(),
  /**
   * CTA destination for `{{short_link}}` (shortened per-recipient at send).
   * Accepts an absolute URL or a root-relative path — stored campaign links may
   * be relative (e.g. a banner's `/banner/:slug`), so a bare `.url()` is too strict.
   */
  linkUrl: z
    .string()
    .max(2000)
    .refine((s) => s === "" || s.startsWith("/") || /^https?:\/\//i.test(s), {
      message: "Ingresa un enlace válido",
    })
    .optional(),
});

export const messageStepSchema = messageContentSchema
  .extend({
    /** Ordered priority; first reachable channel per recipient wins. */
    channelPriority: z.array(campaignChannelSchema).min(1),
  })
  .refine((m) => !!(m.push || m.email || m.sms || m.whatsapp), {
    message: "Escribe el mensaje para al menos un canal",
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

export const campaignModeSchema = z.enum(["once", "evergreen", "drip"]);

export const scheduleStepSchema = z
  .object({
    // "once" = one-shot; "evergreen" = standing rule; "drip" = re-insist non-buyers.
    mode: campaignModeSchema.optional(),
    // once: null/undefined = send now on publish.
    scheduledAt: z.coerce.date().optional(),
    // Smart-delivery bypass ("Especial").
    special: z.boolean().optional(),
    // evergreen: days a customer waits after a send before matching again.
    cooldownDays: z.number().int().min(1).max(365).optional(),
    // evergreen: optional auto-stop instant.
    endsAt: z.coerce.date().optional(),
    // drip: days between insistences + max total attempts (incl. the first).
    dripIntervalDays: z.number().int().min(1).max(90).optional(),
    dripMaxAttempts: z.number().int().min(2).max(10).optional(),
  })
  .refine((s) => s.mode !== "evergreen" || s.cooldownDays != null, {
    message: "Elige cada cuántos días puede volver a recibirla",
    path: ["cooldownDays"],
  });

// Resolve bound-entity names for the editor (chips show the real name on load).
export const resolveEntitiesInputSchema = z.object({
  refs: z
    .array(
      z.object({
        scope: z.enum(["promo", "product", "reward", "category"]),
        id: z.string().min(1),
      }),
    )
    .max(50),
});
export type ResolveEntitiesInput = z.infer<typeof resolveEntitiesInputSchema>;

export type DefinitionStepInput = z.infer<typeof definitionStepSchema>;
export type MessageContentInput = z.infer<typeof messageContentSchema>;
export type MessageStepInput = z.infer<typeof messageStepSchema>;
export type AudienceStepInput = z.infer<typeof audienceFilterSchema>;
export type ScheduleStepInput = z.infer<typeof scheduleStepSchema>;

export const CAMPAIGN_STEP_KEYS = [
  "definition",
  "message",
  "audience",
  "schedule",
] as const;
export type CampaignStepKey = (typeof CAMPAIGN_STEP_KEYS)[number];

// ─── Saved templates (org-scoped reusable messages) ─────────────────────────
export const templateMessageSchema = z.object({
  push: pushContentSchema.optional(),
  email: emailContentSchema.optional(),
  sms: smsContentSchema.optional(),
  whatsapp: whatsappContentSchema.optional(),
});
export const saveTemplateSchema = z.object({
  name: z.string().min(1).max(80),
  message: templateMessageSchema.refine(
    (m) => !!(m.push || m.email || m.sms || m.whatsapp),
    { message: "La plantilla necesita al menos un canal con contenido" },
  ),
  channelPriority: z.array(campaignChannelSchema).optional(),
});
export type SaveTemplateInput = z.infer<typeof saveTemplateSchema>;
export const deleteTemplateSchema = z.object({ id: z.string().uuid() });

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
  /** "once" | "evergreen" — badges the recurring rules in the list. */
  mode: string;
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

// ─── Analytics (honest signals: sent → clicked → redeemed) ───────────────────
export const campaignAnalyticsInputSchema = z.object({
  period: z.enum(["7d", "30d", "90d"]).default("30d"),
});
export type CampaignAnalyticsInput = z.infer<typeof campaignAnalyticsInputSchema>;

export const campaignTimeseriesInputSchema = z.object({ id: z.string().uuid() });

/** One day's honest counters (buckets are per-day in the org timezone). */
export interface CampaignSeriesPoint {
  day: string; // YYYY-MM-DD
  sent: number;
  clicked: number;
  redeemed: number;
}

export interface CampaignLeaderRow {
  id: string;
  name: string;
  sent: number;
  clickRate: number; // clicked / sent
  redeemed: number;
}

/** Org-level campaign analytics for the dashboard strip + the analytics hub. */
export interface CampaignAnalytics {
  kpis: { sent: number; clickRate: number; redeemed: number; active: number };
  series: CampaignSeriesPoint[];
  byChannel: Record<string, number>;
  leaderboard: CampaignLeaderRow[];
}

/** Per-campaign time-series for the detail (+ drip per-attempt breakdown). */
export interface CampaignTimeseries {
  series: CampaignSeriesPoint[];
  attempts:
    | { attempt: number; recipients: number; converted: number }[]
    | null;
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

// ─── Entity → campaign (createFromEntity, source traceability) ───────────────
export const campaignSourceSchema = z.object({
  scope: z.enum(["banner", "promo", "product", "category", "reward"]),
  id: z.string().min(1),
});
export type CampaignSourceInput = z.infer<typeof campaignSourceSchema>;

/**
 * One-shot "create + publish a once-mode announcement for an entity". Bypasses
 * the step wizard: the caller supplies the fully-seeded content. `linkUrl` is a
 * plain string (relative paths allowed, mirroring stored campaign links).
 */
export const createFromEntityInputSchema = z.object({
  source: campaignSourceSchema,
  name: z.string().min(1).max(120),
  message: messageContentSchema.refine((m) => !!(m.push || m.email || m.sms || m.whatsapp), {
    message: "Escribe el mensaje para al menos un canal",
  }),
  channelPriority: z.array(campaignChannelSchema).min(1),
  audienceFilter: audienceFilterSchema.optional(),
  scheduledAt: z.coerce.date().optional(),
});
export type CreateFromEntityInput = z.infer<typeof createFromEntityInputSchema>;

import { z } from "zod";

import { listQueryBase } from "../_shared/list";

// ─── Lifecycle + enums ───────────────────────────────────────────────────────
export const bannerStatusSchema = z.enum(["draft", "published"]);
export const bannerDisplayStateSchema = z.enum([
  "draft",
  "scheduled",
  "active",
  "expired",
]);
export const ctaKindSchema = z.enum(["internal", "external"]);

/** Derived display state for the admin list (not stored). */
export type BannerDisplayState = "draft" | "scheduled" | "active" | "expired";

// ─── Per-step input schemas (reused verbatim by the FE forms) ────────────────
export const contentStepSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and hyphens"),
  shortDescription: z.string().min(1).max(280),
  longDescription: z.string().optional(),
  ctaLabel: z.string().max(60).optional(),
  ctaHref: z.string().max(2048).optional(),
  ctaKind: ctaKindSchema.optional(),
});
export const designStepSchema = z.object({
  backgroundCss: z.string().min(1).max(4096),
  mainImageUrl: z.string().url().optional().or(z.literal("")),
  mainImageBlur: z.string().optional(),
});
export const scheduleStepSchema = z
  .object({
    displayFrom: z.coerce.date().optional(),
    displayUntil: z.coerce.date().optional(),
    // null / empty = every store; a subset restricts the banner to those stores.
    storeIds: z.array(z.string()).nullable().optional(),
  })
  .refine((v) => !(v.displayFrom && v.displayUntil) || v.displayUntil > v.displayFrom, {
    message: "displayUntil must be after displayFrom",
    path: ["displayUntil"],
  });

export type ContentStepInput = z.infer<typeof contentStepSchema>;
export type DesignStepInput = z.infer<typeof designStepSchema>;
export type ScheduleStepInput = z.infer<typeof scheduleStepSchema>;

export const BANNER_STEP_KEYS = ["content", "design", "schedule"] as const;
export type BannerStepKey = (typeof BANNER_STEP_KEYS)[number];

// ─── Public read outputs ─────────────────────────────────────────────────────
export interface BannerCta {
  label: string;
  href: string;
  kind: "internal" | "external";
}

/** Compact banner for the home rail. */
export interface BannerCard {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  backgroundCss: string | null;
  mainImageUrl: string | null;
  mainImageBlur: string | null;
  cta: BannerCta | null;
}

/** Full banner for the detail (modal + SEO page). */
export interface BannerDetail extends BannerCard {
  longDescription: string | null;
  seo: { title: string | null; description: string | null; ogImageUrl: string | null };
}

// ─── Admin IO ────────────────────────────────────────────────────────────────
export const getStateInputSchema = z.object({ id: z.string().uuid() });
export const publishInputSchema = z.object({ id: z.string().uuid() });
export const removeInputSchema = z.object({ id: z.string().uuid() });
export const advanceInputSchema = z.object({
  id: z.string().uuid(),
  step: z.enum(BANNER_STEP_KEYS),
  input: z.unknown(),
});
export const listInputSchema = z.object({
  status: bannerStatusSchema.optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});
export type ListInput = z.infer<typeof listInputSchema>;

// ─── Admin data-table list (nuqs-driven) ─────────────────────────────────────
export const bannersListInputSchema = listQueryBase.extend({
  state: z.array(bannerDisplayStateSchema).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  // Active store scope: keep only banners available at this store (null/empty
  // storeIds = every store). Omitted / sentinel "all" → no store filter.
  storeId: z.string().optional(),
});
export type BannersListInput = z.infer<typeof bannersListInputSchema>;

/** Lean row for the admin data-table (heavy fields stay out). */
export interface BannerListItem {
  id: string;
  slug: string;
  name: string;
  status: string;
  displayState: BannerDisplayState;
  backgroundCss: string | null;
  mainImageUrl: string | null;
  displayFrom: Date | null;
  displayUntil: Date | null;
  storeIds: string[] | null;
  sortOrder: number;
  createdAt: Date;
}

export const bulkIdsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});
export type BulkIdsInput = z.infer<typeof bulkIdsSchema>;

// ─── CTR ingest + stats ──────────────────────────────────────────────────────
export const recordStatInputSchema = z.object({ id: z.string().uuid() });
export type RecordStatInput = z.infer<typeof recordStatInputSchema>;

export const bannerStatsInputSchema = z.object({
  bannerId: z.string().uuid(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});
export type BannerStatsInput = z.infer<typeof bannerStatsInputSchema>;

export interface BannerStatPoint {
  day: string;
  impressions: number;
  clicks: number;
}
export interface BannerStats {
  impressions: number;
  clicks: number;
  ctr: number; // 0–1
  series: BannerStatPoint[];
}

/** One row for the Analytics "Banners" panel (org-level top list). */
export interface BannerAnalyticsRow {
  id: string;
  name: string;
  slug: string;
  impressions: number;
  clicks: number;
  ctr: number;
}
export interface BannerAnalytics {
  totals: { impressions: number; clicks: number; ctr: number; banners: number };
  top: BannerAnalyticsRow[];
  series: BannerStatPoint[];
}

export const reorderInputSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});
export const slugAvailableInputSchema = z.object({
  slug: z.string().min(1),
  excludeId: z.string().uuid().optional(),
});
export const slugInputSchema = z.object({ slug: z.string().min(1) });

// Public home rail: optionally restrict to the customer's active store
// (null/empty storeIds = every store). Omitted → no store filter.
export const homeBannersInputSchema = z.object({ storeId: z.string().optional() });
export type HomeBannersInput = z.infer<typeof homeBannersInputSchema>;

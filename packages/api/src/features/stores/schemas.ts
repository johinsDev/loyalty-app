import { storeAddressSchema } from "@loyalty/address";
import { z } from "zod";

import { listQueryBase } from "../_shared/list";

const time = z.string().regex(/^\d{2}:\d{2}$/);
export const dayHoursSchema = z.object({
  open: time,
  close: time,
  closed: z.boolean(),
});
/** Keys "0" (Sun) – "6" (Sat). */
export const hoursSchema = z.record(z.string().regex(/^[0-6]$/), dayHoursSchema);

/** Per-store social links (null = inherit the org's). */
export const storeSocialLinksSchema = z
  .object({
    instagram: z.string().url().optional().or(z.literal("")),
    whatsapp: z.string().max(40).optional().or(z.literal("")),
    facebook: z.string().url().optional().or(z.literal("")),
    tiktok: z.string().url().optional().or(z.literal("")),
    x: z.string().url().optional().or(z.literal("")),
    website: z.string().url().optional().or(z.literal("")),
  })
  .partial();

/**
 * A store is created as an empty draft (no input), then each wizard step patches
 * its slice via `update`. Branding/contact/schedule fields are `nullish`:
 * `undefined` = no change, `null` = inherit the org's value.
 */
export const updateStoreInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().max(120).optional(),
  address: storeAddressSchema.nullish(),
  phone: z.string().max(40).nullish(),
  hours: hoursSchema.nullish(),
  timezone: z.string().max(64).optional(),
  logo: z.string().url().nullish().or(z.literal("")),
  socialLinks: storeSocialLinksSchema.nullish(),
  isPrimary: z.boolean().optional(),
  isPublished: z.boolean().optional(),
});
export type UpdateStoreInput = z.infer<typeof updateStoreInputSchema>;

export const idInputSchema = z.object({ id: z.string().uuid() });

/** Quick-create from the store switcher: an optional name, then the wizard. */
export const createStoreInputSchema = z.object({
  name: z.string().trim().max(120).optional(),
});
export type CreateStoreInput = z.infer<typeof createStoreInputSchema>;

/** Lean row for the admin store switcher (no heavy columns). `slug` powers the
 *  `/[store]` URL segment; `null` for legacy rows not yet backfilled. */
export interface StoreSwitcherItem {
  id: string;
  slug: string | null;
  name: string;
  isPrimary: boolean;
  status: string;
}

export type StoreSocialLinks = z.infer<typeof storeSocialLinksSchema>;

// ── Admin data-table list + bulk ──────────────────────────────────────────────
export const storeStatusSchema = z.enum(["draft", "published"]);

/** Server-driven list query for the admin data-table (URL-driven via nuqs). */
export const storesListInputSchema = listQueryBase.extend({
  status: z.array(storeStatusSchema).optional(),
  visible: z.array(z.boolean()).optional(),
  primary: z.enum(["primary", "secondary"]).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
});
export type StoresListInput = z.infer<typeof storesListInputSchema>;

/** Lean row for the admin table (the heavy JSON columns stay out of the list). */
export interface StoreListItem {
  id: string;
  name: string;
  address: string | null;
  status: string;
  isPrimary: boolean;
  isPublished: boolean;
  createdAt: Date;
}

export const bulkIdsSchema = z.object({ ids: z.array(z.string().uuid()).min(1).max(500) });
export type BulkIdsInput = z.infer<typeof bulkIdsSchema>;

export const bulkSetPublishedSchema = bulkIdsSchema.extend({ isPublished: z.boolean() });
export type BulkSetPublishedInput = z.infer<typeof bulkSetPublishedSchema>;

/** Customer-facing view with org-inherited fields already resolved. */
export interface StoreView {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  hours: Record<string, { open: string; close: string; closed: boolean }> | null;
  timezone: string;
  mapStaticUrl: string | null;
  directionsUrl: string | null;
  logo: string | null;
  socialLinks: Record<string, string>;
  isPrimary: boolean;
}

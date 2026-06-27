import { storeAddressSchema } from "@loyalty/address";
import { z } from "zod";

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

export type StoreSocialLinks = z.infer<typeof storeSocialLinksSchema>;

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

import { z } from "zod";

const time = z.string().regex(/^\d{2}:\d{2}$/);
export const dayHoursSchema = z.object({
  open: time,
  close: time,
  closed: z.boolean(),
});
/** Keys "0" (Sun) – "6" (Sat). */
export const hoursSchema = z.record(z.string().regex(/^[0-6]$/), dayHoursSchema);

export const createStoreInputSchema = z.object({
  name: z.string().min(1).max(120),
  address: z.string().max(300).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  placeId: z.string().max(300).optional(),
  phone: z.string().max(40).optional(),
  hours: hoursSchema.optional(),
  timezone: z.string().max(64).optional(),
  isPublished: z.boolean().optional(),
});
export type CreateStoreInput = z.infer<typeof createStoreInputSchema>;

export const updateStoreInputSchema = createStoreInputSchema
  .partial()
  .extend({ id: z.string().uuid() });
export type UpdateStoreInput = z.infer<typeof updateStoreInputSchema>;

export const idInputSchema = z.object({ id: z.string().uuid() });

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
  isPrimary: boolean;
}

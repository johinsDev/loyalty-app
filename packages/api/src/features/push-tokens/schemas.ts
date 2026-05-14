import { z } from "zod";

/**
 * Both push protocols share these enums. `webpush` tokens are the
 * JSON-stringified `PushSubscription` returned by the browser;
 * `expo` tokens are the `ExponentPushToken[…]` strings.
 */
export const pushPlatformSchema = z.enum(["webpush", "expo"]);

export const registerInputSchema = z.object({
  customerId: z.string().uuid(),
  organizationId: z.string().min(1),
  platform: pushPlatformSchema,
  token: z.string().min(1),
  deviceLabel: z.string().max(255).optional(),
});

export const revokeInputSchema = z.object({
  customerId: z.string().uuid(),
  organizationId: z.string().min(1),
  token: z.string().min(1),
});

export const listForCustomerInputSchema = z.object({
  customerId: z.string().uuid(),
  organizationId: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;
export type RevokeInput = z.infer<typeof revokeInputSchema>;
export type ListForCustomerInput = z.infer<typeof listForCustomerInputSchema>;

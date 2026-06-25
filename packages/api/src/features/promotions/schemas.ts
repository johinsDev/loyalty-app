import { z } from "zod";

// ─── Enums ───────────────────────────────────────────────────────────────────
export const promoStatusSchema = z.enum(["draft", "published"]);
export const promoTypeSchema = z.enum([
  "percentage",
  "fixed",
  "nForM",
  "freeItem",
  "pointsMultiplier",
]);
export const scopeKindSchema = z.enum(["order", "products", "categories"]);
export const audienceTypeSchema = z.enum(["all", "tier", "specific"]);
export const tierKeySchema = z.enum(["hoja", "flor", "oro"]);

// ─── Benefit (discriminated by type) ────────────────────────────────────────
export const benefitSchema = z.union([
  z.object({ percent: z.number().min(1).max(100), maxDiscountCents: z.number().int().min(0).optional() }),
  z.object({ amountCents: z.number().int().min(1) }),
  z.object({ buyQty: z.number().int().min(2), payQty: z.number().int().min(1) }),
  z.object({
    freeRef: z.object({
      kind: z.enum(["product", "variant", "modifier"]),
      id: z.string().min(1),
    }),
  }),
  z.object({ multiplier: z.number().min(1) }),
]);

export const scopeSchema = z.object({
  productIds: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).optional(),
});

export const conditionsSchema = z.object({
  minPurchaseCents: z.number().int().min(0).optional(),
  maxDiscountCents: z.number().int().min(0).optional(),
  firstPurchaseOnly: z.boolean().optional(),
  maxUsesTotal: z.number().int().min(1).optional(),
  maxPerCustomer: z.number().int().min(1).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  hoursFrom: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  hoursTo: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

// ─── Admin IO ────────────────────────────────────────────────────────────────
export const updateInputSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120).optional(),
  slug: z.string().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  shortDescription: z.string().max(280).optional(),
  longDescription: z.string().optional(),
  badgeLabel: z.string().max(24).optional(),
  icon: z.string().max(60).optional(),
  backgroundCss: z.string().max(4096).optional(),
  mainImageUrl: z.string().url().optional().or(z.literal("")),
  type: promoTypeSchema.optional(),
  benefit: benefitSchema.optional(),
  scopeKind: scopeKindSchema.optional(),
  scope: scopeSchema.optional(),
  conditions: conditionsSchema.optional(),
  audienceType: audienceTypeSchema.optional(),
  tierKey: tierKeySchema.optional(),
  audienceCustomerIds: z.array(z.string()).optional(),
  stackable: z.boolean().optional(),
  category: z.string().max(60).optional(),
  featured: z.boolean().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
});
export type UpdateInput = z.infer<typeof updateInputSchema>;

export const idInputSchema = z.object({ id: z.string().uuid() });
export const slugInputSchema = z.object({ slug: z.string().min(1) });
export const listInputSchema = z.object({
  status: promoStatusSchema.optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(25),
});
export type ListInput = z.infer<typeof listInputSchema>;

// ─── Customer browse IO ──────────────────────────────────────────────────────
export const publicListInputSchema = z.object({
  category: z.string().optional(),
  cursor: z.string().nullish(),
  pageSize: z.number().int().min(1).max(40).default(12),
});
export type PublicListInput = z.infer<typeof publicListInputSchema>;

// ─── Apply / checkout IO ─────────────────────────────────────────────────────
export const cartLineSchema = z.object({
  productId: z.string().min(1),
  variantId: z.string().nullish(),
  modifierOptionIds: z.array(z.string()).optional(),
  qty: z.number().int().min(1),
  unitAmountCents: z.number().int().min(0),
});
export const cartSchema = z.object({
  currency: z.string().default("COP"),
  lines: z.array(cartLineSchema),
});
export const applicableInputSchema = z.object({
  customerId: z.string().min(1),
  cart: cartSchema,
});

// ─── Outputs ─────────────────────────────────────────────────────────────────
export interface PromoCard {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  badgeLabel: string | null;
  icon: string | null;
  backgroundCss: string | null;
  mainImageUrl: string | null;
  category: string | null;
  featured: boolean;
}
export interface PromoDetail extends PromoCard {
  longDescription: string | null;
  type: string | null;
  stackable: boolean;
  seo: { title: string | null; description: string | null; ogImageUrl: string | null };
}
export interface ApplicablePromo {
  promo: PromoCard;
  discountCents: number;
  pointsMultiplier: number;
}

// ─── Notifications IO ────────────────────────────────────────────────────────
export const promoChannelSchema = z.enum(["push", "database", "realtime"]);
export const repeatSchema = z.enum(["none", "weekly"]);
export const createNotificationInputSchema = z
  .object({
    promoId: z.string().uuid(),
    audienceType: audienceTypeSchema,
    tierKey: tierKeySchema.optional(),
    customerIds: z.array(z.string()).optional(),
    channels: z.array(promoChannelSchema).min(1),
    scheduledAt: z.coerce.date().optional(),
    repeat: repeatSchema.default("none"),
  })
  .refine((v) => v.audienceType !== "tier" || !!v.tierKey, {
    message: "tierKey required",
    path: ["tierKey"],
  })
  .refine((v) => v.audienceType !== "specific" || (v.customerIds?.length ?? 0) > 0, {
    message: "customerIds required",
    path: ["customerIds"],
  })
  .refine((v) => v.repeat !== "weekly" || !!v.scheduledAt, {
    message: "scheduledAt required for weekly",
    path: ["scheduledAt"],
  });
export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;

export const listNotificationsInputSchema = z.object({ promoId: z.string().uuid() });
export const cancelNotificationInputSchema = z.object({ id: z.string().uuid() });

export interface PromoNotificationView {
  id: string;
  audienceType: "all" | "tier" | "specific";
  tierKey: string | null;
  customerCount: number | null;
  channels: string[];
  scheduledAt: Date | null;
  repeat: string;
  status: string;
}

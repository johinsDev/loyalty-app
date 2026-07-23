import { z } from "zod";

import { listQueryBase } from "../_shared/list";

// ---- shared ----------------------------------------------------------------

export const customerIdInputSchema = z.object({ customerId: z.string().min(1) });
export const tierKeySchema = z.enum(["hoja", "flor", "oro"]);
export const customerStatusSchema = z.enum(["active", "banned", "inactive"]);

// ---- quick-register PIN (cashier) ------------------------------------------

/** Start a quick-register: send a WhatsApp PIN to `phone` (E.164). The cashier
 *  confirms the code before the account is created. */
export const requestRegisterPinInputSchema = z.object({
  phone: z.string().min(6).max(20),
  name: z.string().trim().max(120).optional(),
  /** The active register store, captured as the acquisition store. */
  storeId: z.string().min(1).optional(),
});
export type RequestRegisterPinInput = z.infer<typeof requestRegisterPinInputSchema>;

export const confirmRegisterPinInputSchema = z.object({
  pendingId: z.string().min(1),
  code: z.string().regex(/^\d{6}$/),
});
export type ConfirmRegisterPinInput = z.infer<typeof confirmRegisterPinInputSchema>;

// ---- admin list ------------------------------------------------------------

/** Server-driven list for the admin data-table (URL-driven via nuqs). */
export const customersListInputSchema = listQueryBase.extend({
  tiers: z.array(tierKeySchema).optional(),
  status: z.array(customerStatusSchema).optional(),
  joinedFrom: z.coerce.date().optional(),
  joinedTo: z.coerce.date().optional(),
  spendMin: z.number().int().min(0).optional(),
  spendMax: z.number().int().min(0).optional(),
});
export type CustomersListInput = z.infer<typeof customersListInputSchema>;

/** Lean row for the customers table (aggregates exclude voided sales). */
export interface CustomerListItem {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  tierKey: string | null;
  banned: boolean;
  visits: number;
  ltvCents: number;
  lastVisitAt: Date | null;
  createdAt: Date;
}

export interface CustomersKpis {
  total: number;
  new30d: number;
  active30d: number;
  avgLtvCents: number;
}

export const bulkIdsSchema = z.object({ ids: z.array(z.string()).min(1).max(500) });

// ---- detail ----------------------------------------------------------------

export interface CustomerDetail {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  nickname: string | null;
  avatarPreset: string | null;
  avatarUrl: string | null;
  birthday: Date | null;
  notes: string | null;
  tierKey: string | null;
  createdAt: Date;
  banned: boolean;
  banReason: string | null;
  lastVisitAt: Date | null;
  daysSinceLastVisit: number | null;
}

// ---- register context (staff-safe, cashier pane) ---------------------------

/** Lean, PII-masked customer detail for the cashier register. Complements the
 *  wallet (stamps) fetched separately; carries the CRM context a cashier uses
 *  to serve a customer personally — masked contact, tier/points, visit stats,
 *  acquisition, ban. Phone/email are masked; never expose raw PII to staff. */
export interface RegisterContext {
  id: string;
  name: string | null;
  phoneMasked: string;
  emailMasked: string | null;
  /** Month/day only matter for the greeting; year kept for "X años". */
  birthday: Date | null;
  /** 0 = birthday today, 1-7 = within the coming week, null = not soon/unknown. */
  birthdayInDays: number | null;
  memberSince: Date;
  /** Staff free-form note (allergies/preferences) — helps serve personally. */
  notes: string | null;
  tierKey: string | null;
  /** Windowed tier standing — name, benefits and progress to the next tier
   *  (drives the register's "Info del cliente" tier panel). */
  tier: {
    key: string;
    name: string;
    benefits: string[];
    nextName: string | null;
    tierPoints: number;
    nextThreshold: number | null;
    remainingToNext: number;
    progress: number;
  };
  points: number;
  visits: number;
  avgTicketCents: number;
  lastVisitAt: Date | null;
  topProduct: string | null;
  acquisition: { channel: string | null; storeId: string | null; storeName: string | null };
  banned: boolean;
}

// ---- stats (overview tab) --------------------------------------------------

export interface CustomerStats {
  ltvCents: number;
  avgTicketCents: number;
  visits: number;
  /** Average days between visits (null with < 2 visits). */
  avgDaysBetween: number | null;
  daysSinceLastVisit: number | null;
  memberSince: Date;
  /** Percentile by lifetime spend among org customers, 0-100 ("top X%"). */
  spendPercentile: number | null;
  /** Last 6 calendar months, oldest→newest. */
  monthly: { month: string; spendCents: number; visits: number }[];
  favoriteStore: { id: string; name: string | null; visits: number } | null;
  /** Most-bought products, qty desc, up to 5. */
  topProducts: { productId: string; name: string | null; qty: number }[];
  /** How this customer pays for rewards. Both zero → never redeemed. */
  redemptionMix: { stamps: number; points: number };
}

// ---- loyalty tab (staff-scoped ledgers) ------------------------------------

/** Cursor-paginated ledger input (createdAt ISO cursor). */
export const ledgerInputSchema = customerIdInputSchema.extend({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});
export type LedgerInput = z.infer<typeof ledgerInputSchema>;

export interface PointsLedgerRow {
  id: string;
  type: "earn" | "redeem" | "adjust";
  points: number;
  reason: string | null;
  createdAt: Date;
}
export interface StampsHistoryRow {
  id: string;
  amount: number;
  note: string | null;
  hasPurchase: boolean;
  createdAt: Date;
}
export interface RedemptionHistoryRow {
  id: string;
  rewardName: string | null;
  currency: string;
  stampsSpent: number;
  pointsSpent: number;
  createdAt: Date;
}
export interface LedgerView<T> {
  items: T[];
  nextCursor: string | null;
}

// ---- timeline (activity tab) -----------------------------------------------

export const timelineInputSchema = customerIdInputSchema.extend({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(40).default(20),
});
export type TimelineInput = z.infer<typeof timelineInputSchema>;

export type TimelineKind =
  | "purchase"
  | "redeem"
  | "points"
  | "stamp"
  | "tier"
  | "message"
  | "admin";

export interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  at: Date;
  /** Short title, resolved server-side (product summary / reward name / …). */
  title: string;
  /** Optional secondary detail (channel, reason, amount label). */
  detail: string | null;
  /** Signed amount for points/stamp events. */
  amount: number | null;
  /** Deep-link target id (purchase id, reward id, …) when navigable. */
  refId: string | null;
  /** Flags a voided purchase / destructive admin event for styling. */
  negative: boolean;
}
export interface TimelineView {
  items: TimelineEvent[];
  nextCursor: string | null;
}

// ---- availability check ----------------------------------------------------

export const checkAvailabilityInputSchema = z
  .object({
    field: z.enum(["phone", "email", "nickname"]),
    value: z.string().trim().min(1).max(200),
    /** Exclude this customer's own value when editing. */
    excludeId: z.string().optional(),
  })
  .strict();
export type CheckAvailabilityInput = z.infer<typeof checkAvailabilityInputSchema>;

// ---- create / update -------------------------------------------------------

const phoneSchema = z.string().trim().min(6).max(20);
const emailSchema = z.string().trim().email().max(200);
const nameSchema = z.string().trim().max(120);
const nicknameSchema = z.string().trim().min(2).max(40);
const notesSchema = z.string().trim().max(500);

/** Channels the admin can pre-set a marketing opt-out for at creation, and
 *  toggle on edit. Mirrors the notifications `preferenceChannelSchema`. */
export const marketingChannelSchema = z.enum(["mail", "sms", "push", "whatsapp"]);
export type MarketingChannel = z.infer<typeof marketingChannelSchema>;
export const MARKETING_CHANNELS = marketingChannelSchema.options;

/** Admin create — mints a Better Auth phone-first user + the customer row. */
export const createCustomerInputSchema = z.object({
  phone: phoneSchema,
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  nickname: nicknameSchema.optional(),
  birthday: z.coerce.date().optional(),
  notes: notesSchema.optional(),
  /** Channels the customer is opted IN to; the rest are stored as opt-outs. */
  marketingChannels: z.array(marketingChannelSchema).optional(),
  /** Initial loyalty load applied on creation (reason "alta inicial"). */
  initialStamps: z.number().int().min(0).max(100).optional(),
  initialPoints: z.number().int().min(0).max(100_000).optional(),
});
export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>;

export const updateCustomerInputSchema = z.object({
  id: z.string().min(1),
  phone: phoneSchema.optional(),
  name: nameSchema.optional(),
  email: emailSchema.nullable().optional(),
  nickname: nicknameSchema.nullable().optional(),
  birthday: z.coerce.date().nullable().optional(),
  notes: notesSchema.nullable().optional(),
  /** When present, replaces the customer's opted-in channel set. */
  marketingChannels: z.array(marketingChannelSchema).optional(),
});
export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>;

// ---- ban -------------------------------------------------------------------

export const banCustomerInputSchema = z.object({
  customerId: z.string().min(1),
  reason: z.string().trim().min(1).max(200),
});
export type BanCustomerInput = z.infer<typeof banCustomerInputSchema>;

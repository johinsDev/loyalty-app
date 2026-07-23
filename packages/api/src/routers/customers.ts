import { type db as Db, getPrimaryOrganizationId, phoneNumberInUse } from "@loyalty/db";
import { TRPCError } from "@trpc/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import { CustomersRepository } from "../features/customers/repository";
import {
  banCustomerInputSchema,
  bulkIdsSchema,
  checkAvailabilityInputSchema,
  confirmRegisterPinInputSchema,
  createCustomerInputSchema,
  customerIdInputSchema,
  customersListInputSchema,
  ledgerInputSchema,
  MARKETING_CHANNELS,
  type MarketingChannel,
  requestRegisterPinInputSchema,
  timelineInputSchema,
  updateCustomerInputSchema,
} from "../features/customers/schemas";
import { type Actor, CustomersService } from "../features/customers/service";
import { getLoyaltyConfig } from "../features/_shared/localize";
import { maskEmail, maskPhone } from "../features/_shared/mask";
import {
  clearPendingRegister,
  storePendingRegister,
  verifyRegisterPin,
} from "../features/_shared/register-pin";
import { requireCache } from "../features/_shared/claim-code";
import { DrizzleNotificationPreferences } from "../features/notifications/preferences-repository";
import { WINDOW_DAYS } from "../features/points/config";
import { PointsRepository } from "../features/points/repository";
import { PointsService } from "../features/points/service";
import { tierFor } from "../features/points/tier-calc";
import { StampsRepository } from "../features/stamps/repository";
import { StampsService } from "../features/stamps/service";
import { managerProcedure, ownerProcedure, rateLimit, router, staffProcedure } from "../trpc";

const orgId = async (): Promise<string> => (await getPrimaryOrganizationId()) ?? "";
async function requireOrg(): Promise<string> {
  const id = await getPrimaryOrganizationId();
  if (!id) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active organization" });
  return id;
}

const repo = (db: typeof Db) => new CustomersRepository(db);
const readSvc = (db: typeof Db) => new CustomersService(repo(db));

/** Days until the customer's next birthday, but only within the coming week
 *  (0 = today) — otherwise null. Drives the register's "🎂" nudge. */
function daysUntilBirthday(birthday: Date | null): number | null {
  if (!birthday) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), birthday.getMonth(), birthday.getDate());
  if (next < today) next = new Date(now.getFullYear() + 1, birthday.getMonth(), birthday.getDate());
  const days = Math.round((next.getTime() - today.getTime()) / 86_400_000);
  return days <= 7 ? days : null;
}

interface ActorCtx {
  db: typeof Db;
  session: { user: { id: string } };
  headers: Headers;
}

/** Build the operator actor, wiring the loyalty + preference writers so the
 *  customers service can apply an initial load / opt-outs without importing the
 *  heavy stamps/points/notifications graphs itself. */
function actorOf(ctx: ActorCtx, org: string): Actor {
  const points = new PointsService(new PointsRepository(ctx.db));
  const stamps = new StampsService(new StampsRepository(ctx.db), {});
  const prefs = new DrizzleNotificationPreferences(ctx.db);
  const by = ctx.session.user.id;
  return {
    userId: by,
    headers: ctx.headers,
    applyStamps: async (customerId, amount, reason) => {
      const loyalty = await getLoyaltyConfig(ctx.db, org);
      await stamps.adjustForCustomer(org, customerId, amount, reason, by, {
        goal: loyalty.stamps.goal,
        purchasesPerStamp: loyalty.stamps.purchasesPerStamp,
      });
    },
    applyPoints: async (customerId, amount, reason) => {
      await points.adjustForCustomer(org, customerId, amount, reason, by);
    },
    setMarketing: (customerId, channel, enabled) =>
      prefs.setMarketingEnabled(customerId, org, channel, enabled),
  };
}

export const customersRouter = router({
  /** Cashier customer picker — search by name / phone / email, org-scoped. */
  search: staffProcedure
    .input(z.object({ query: z.string().default(""), limit: z.number().int().min(1).max(50).default(20) }))
    .query(async ({ ctx, input }) => repo(ctx.db).search(await orgId(), input.query, input.limit)),

  /** Cashier register: lean, PII-masked customer detail (complements the wallet).
   *  Staff-safe — masked phone/email, no raw contact ever leaves the server. */
  registerContext: staffProcedure
    .input(customerIdInputSchema)
    .query(async ({ ctx, input }) => {
      const org = await requireOrg();
      const raw = await repo(ctx.db).registerContext(org, input.customerId);
      if (!raw) throw new TRPCError({ code: "NOT_FOUND", message: "CUSTOMER_NOT_FOUND" });
      // Windowed tier standing (name / benefits / progress to next).
      const windowStart = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
      const tierPoints = await new PointsRepository(ctx.db)
        .tierPoints(org, input.customerId, windowStart)
        .catch(() => 0);
      const tv = tierFor(tierPoints);
      return {
        id: raw.id,
        name: raw.name,
        phoneMasked: maskPhone(raw.phone),
        emailMasked: maskEmail(raw.email),
        birthday: raw.birthday,
        birthdayInDays: daysUntilBirthday(raw.birthday),
        memberSince: raw.memberSince,
        notes: raw.notes,
        tierKey: raw.tierKey,
        tier: {
          key: tv.current.key,
          name: tv.current.name,
          benefits: tv.current.benefits.map((b) => b.label),
          nextName: tv.next?.name ?? null,
          tierPoints,
          nextThreshold: tv.next?.threshold ?? null,
          remainingToNext: tv.remainingToNext,
          progress: tv.progress,
        },
        points: raw.points,
        visits: raw.visits,
        avgTicketCents: raw.avgTicketCents,
        lastVisitAt: raw.lastVisitAt,
        topProduct: raw.topProduct,
        acquisition: raw.acquisition,
        banned: raw.banned,
      };
    }),

  /** Quick-register step 1: send a 6-digit PIN to the phone over WhatsApp and
   *  hold the pending registration. The account is only created once the cashier
   *  confirms the code (step 2) — a blocking check the phone is reachable. */
  requestRegisterPin: staffProcedure
    .use(rateLimit({ name: "customers.requestRegisterPin", limit: 10, window: "10m", by: "user" }))
    .input(requestRegisterPinInputSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await requireOrg();
      // The phone must be free before we bother sending a PIN.
      const available = await repo(ctx.db).checkAvailability(org, {
        field: "phone",
        value: input.phone,
      });
      if (!available || (await phoneNumberInUse(input.phone))) {
        throw new TRPCError({ code: "CONFLICT", message: "PHONE_IN_USE" });
      }
      const cache = requireCache(ctx.cache);
      const { pendingId, code } = await storePendingRegister(cache, {
        phone: input.phone,
        name: input.name?.trim() || null,
        organizationId: org,
        staffId: ctx.session.user.id,
        acquisitionStoreId: input.storeId ?? null,
      });
      // Reuse the login OTP WhatsApp task (phoneNumber + code) — best-effort; a
      // failed send just means the cashier retries.
      await tasks
        .trigger("send-otp-whatsapp", { phoneNumber: input.phone, code })
        .catch(() => {});
      return { pendingId };
    }),

  /** Quick-register step 2: verify the PIN, then mint the customer. Returns the
   *  new customer so the register can select them and continue the sale. */
  confirmRegisterPin: staffProcedure
    .input(confirmRegisterPinInputSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await requireOrg();
      const cache = requireCache(ctx.cache);
      const pending = await verifyRegisterPin(
        cache,
        input.pendingId,
        input.code,
        ctx.session.user.id,
      );
      const id = await readSvc(ctx.db).quickCreate(org, actorOf(ctx, org), {
        phone: pending.phone,
        name: pending.name,
        acquisitionStoreId: pending.acquisitionStoreId,
      });
      await clearPendingRegister(cache, input.pendingId);
      return { id, name: pending.name, phone: pending.phone };
    }),

  // ── Admin CRM (managers) ─────────────────────────────────────────────────
  adminList: managerProcedure
    .input(customersListInputSchema)
    .query(async ({ ctx, input }) => readSvc(ctx.db).adminList(await requireOrg(), input)),

  adminListByIds: managerProcedure
    .input(bulkIdsSchema)
    .query(async ({ ctx, input }) => readSvc(ctx.db).listByIds(await requireOrg(), input.ids)),

  adminKpis: managerProcedure.query(async ({ ctx }) => readSvc(ctx.db).adminKpis(await requireOrg())),

  adminGet: managerProcedure
    .input(customerIdInputSchema)
    .query(async ({ ctx, input }) => readSvc(ctx.db).adminGet(await requireOrg(), input.customerId)),

  stats: managerProcedure
    .input(customerIdInputSchema)
    .query(async ({ ctx, input }) => readSvc(ctx.db).stats(await requireOrg(), input.customerId)),

  pointsLedger: managerProcedure
    .input(ledgerInputSchema)
    .query(async ({ ctx, input }) => readSvc(ctx.db).pointsLedger(await requireOrg(), input)),

  stampsHistory: managerProcedure
    .input(ledgerInputSchema)
    .query(async ({ ctx, input }) => readSvc(ctx.db).stampsHistory(await requireOrg(), input)),

  redemptionsHistory: managerProcedure
    .input(ledgerInputSchema)
    .query(async ({ ctx, input }) => readSvc(ctx.db).redemptionsHistory(await requireOrg(), input)),

  timeline: managerProcedure
    .input(timelineInputSchema)
    .query(async ({ ctx, input }) => readSvc(ctx.db).timeline(await requireOrg(), input)),

  checkAvailability: managerProcedure
    .input(checkAvailabilityInputSchema)
    .query(async ({ ctx, input }) => readSvc(ctx.db).checkAvailability(await requireOrg(), input)),

  /** Channels the customer is opted IN to (for the edit wizard). No stored row
   *  means subscribed, so opted-in = all marketing channels minus opt-outs. */
  marketingChannels: managerProcedure
    .input(customerIdInputSchema)
    .query(async ({ ctx, input }): Promise<MarketingChannel[]> => {
      const optedOut = await new DrizzleNotificationPreferences(ctx.db).optedOutChannels(
        input.customerId,
        await requireOrg(),
      );
      return MARKETING_CHANNELS.filter((ch) => !optedOut.has(ch));
    }),

  // ── Write ────────────────────────────────────────────────────────────────
  create: managerProcedure
    .input(createCustomerInputSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await requireOrg();
      const id = await readSvc(ctx.db).create(org, actorOf(ctx, org), input);
      return { id };
    }),

  update: managerProcedure
    .input(updateCustomerInputSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await requireOrg();
      await readSvc(ctx.db).update(org, actorOf(ctx, org), input);
      return { ok: true };
    }),

  ban: ownerProcedure
    .input(banCustomerInputSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await requireOrg();
      await readSvc(ctx.db).ban(org, actorOf(ctx, org), input.customerId, input.reason);
      return { ok: true };
    }),

  unban: ownerProcedure
    .input(customerIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await requireOrg();
      await readSvc(ctx.db).unban(org, actorOf(ctx, org), input.customerId);
      return { ok: true };
    }),
});

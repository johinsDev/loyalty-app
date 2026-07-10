import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { CustomersRepository } from "../features/customers/repository";
import {
  banCustomerInputSchema,
  bulkIdsSchema,
  checkAvailabilityInputSchema,
  createCustomerInputSchema,
  customerIdInputSchema,
  customersListInputSchema,
  ledgerInputSchema,
  MARKETING_CHANNELS,
  type MarketingChannel,
  timelineInputSchema,
  updateCustomerInputSchema,
} from "../features/customers/schemas";
import { type Actor, CustomersService } from "../features/customers/service";
import { DrizzleNotificationPreferences } from "../features/notifications/preferences-repository";
import { PointsRepository } from "../features/points/repository";
import { PointsService } from "../features/points/service";
import { StampsRepository } from "../features/stamps/repository";
import { StampsService } from "../features/stamps/service";
import { managerProcedure, ownerProcedure, router, staffProcedure } from "../trpc";

const orgId = async (): Promise<string> => (await getPrimaryOrganizationId()) ?? "";
async function requireOrg(): Promise<string> {
  const id = await getPrimaryOrganizationId();
  if (!id) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active organization" });
  return id;
}

const repo = (db: typeof Db) => new CustomersRepository(db);
const readSvc = (db: typeof Db) => new CustomersService(repo(db));

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
      await stamps.adjustForCustomer(org, customerId, amount, reason, by);
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

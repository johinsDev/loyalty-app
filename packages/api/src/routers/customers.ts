import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { CustomersRepository } from "../features/customers/repository";
import {
  banCustomerInputSchema,
  bulkIdsSchema,
  checkAvailabilityInputSchema,
  customerIdInputSchema,
  customersListInputSchema,
  ledgerInputSchema,
  timelineInputSchema,
  updateCustomerInputSchema,
} from "../features/customers/schemas";
import { type Actor, CustomersService } from "../features/customers/service";
import { managerProcedure, ownerProcedure, router, staffProcedure } from "../trpc";

const orgId = async (): Promise<string> => (await getPrimaryOrganizationId()) ?? "";
async function requireOrg(): Promise<string> {
  const id = await getPrimaryOrganizationId();
  if (!id) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active organization" });
  return id;
}

const repo = (db: typeof Db) => new CustomersRepository(db);
const readSvc = (db: typeof Db) => new CustomersService(repo(db));
const actorOf = (ctx: { session: { user: { id: string } }; headers: Headers }): Actor => ({
  userId: ctx.session.user.id,
  headers: ctx.headers,
});

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

  // ── Write ────────────────────────────────────────────────────────────────
  update: managerProcedure
    .input(updateCustomerInputSchema)
    .mutation(async ({ ctx, input }) => {
      await readSvc(ctx.db).update(await requireOrg(), actorOf(ctx), input);
      return { ok: true };
    }),

  ban: ownerProcedure
    .input(banCustomerInputSchema)
    .mutation(async ({ ctx, input }) => {
      await readSvc(ctx.db).ban(await requireOrg(), actorOf(ctx), input.customerId, input.reason);
      return { ok: true };
    }),

  unban: ownerProcedure
    .input(customerIdInputSchema)
    .mutation(async ({ ctx, input }) => {
      await readSvc(ctx.db).unban(await requireOrg(), actorOf(ctx), input.customerId);
      return { ok: true };
    }),
});

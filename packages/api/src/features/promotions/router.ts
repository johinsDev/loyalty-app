import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";

import { loadLocaleContext } from "../_shared/localize";
import { managerProcedure, publicProcedure, router, staffProcedure } from "../../trpc";
import { PromoRepository } from "./repository";
import {
  applicableInputSchema,
  cancelNotificationInputSchema,
  createNotificationInputSchema,
  idInputSchema,
  listInputSchema,
  listNotificationsInputSchema,
  publicListInputSchema,
  slugInputSchema,
  updateInputSchema,
} from "./schemas";
import { PromoService } from "./service";

function makeService(db: typeof Db): PromoService {
  return new PromoService(db, new PromoRepository(db));
}
const orgId = async (): Promise<string> => (await getPrimaryOrganizationId()) ?? "";
async function requireOrg(): Promise<string> {
  const id = await getPrimaryOrganizationId();
  if (!id) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active organization" });
  return id;
}

/**
 * Promotions. Public localized reads (home rail + /promos hub + detail), a
 * manager CRUD authoring flow (create draft → patch → publish), and the staff
 * `applicable` evaluation used at checkout (eligibility + computed discount).
 */
export const promocionesRouter = router({
  // ── Public (cacheable, localized) ──────────────────────────────────────────
  homePromos: publicProcedure.query(async ({ ctx }) => {
    const id = await orgId();
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return makeService(ctx.db).homePromos(id, lc);
  }),
  listPublic: publicProcedure.input(publicListInputSchema).query(async ({ ctx, input }) => {
    const id = await orgId();
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return makeService(ctx.db).listPromos(id, lc, input);
  }),
  bySlug: publicProcedure.input(slugInputSchema).query(async ({ ctx, input }) => {
    const id = await orgId();
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return makeService(ctx.db).promoBySlug(id, input.slug, lc);
  }),

  // ── Admin (managers + owners) ──────────────────────────────────────────────
  create: managerProcedure.mutation(async ({ ctx }) =>
    makeService(ctx.db).create(await requireOrg(), ctx.session.user.id),
  ),
  get: managerProcedure
    .input(idInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).get(await requireOrg(), input.id)),
  update: managerProcedure
    .input(updateInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).update(await requireOrg(), input)),
  publish: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).publish(await requireOrg(), input.id)),
  list: managerProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).list(await requireOrg(), input)),
  remove: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).remove(await requireOrg(), input.id)),

  // ── Checkout (cashier) ─────────────────────────────────────────────────────
  applicable: staffProcedure.input(applicableInputSchema).query(async ({ ctx, input }) => {
    const id = await requireOrg();
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return makeService(ctx.db).applicable(id, input.customerId, input.cart, lc);
  }),

  // ── Notifications (managers) ───────────────────────────────────────────────
  notifications: router({
    list: managerProcedure
      .input(listNotificationsInputSchema)
      .query(async ({ ctx, input }) => makeService(ctx.db).listNotifications(input.promoId)),
    create: managerProcedure
      .input(createNotificationInputSchema)
      .mutation(async ({ ctx, input }) =>
        makeService(ctx.db).createNotification(await requireOrg(), input),
      ),
    cancel: managerProcedure
      .input(cancelNotificationInputSchema)
      .mutation(async ({ ctx, input }) => makeService(ctx.db).cancelNotification(input.id)),
  }),
});

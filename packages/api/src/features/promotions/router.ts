import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { loadLocaleContext } from "../_shared/localize";
import { managerProcedure, publicProcedure, router, staffProcedure } from "../../trpc";
import { PromoRepository } from "./repository";
import {
  adminListInputSchema,
  applicableInputSchema,
  idInputSchema,
  itemRefSchema,
  patchContentSchema,
  promoAnalyticsInputSchema,
  publicListInputSchema,
  slugInputSchema,
} from "./schemas";
import { PromoService } from "./service";
import { PROMO_TEMPLATES } from "./templates";

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
 * Promotions. Public localized reads (home rail + /promos hub + detail), the
 * manager server-driven wizard (create → getState/advance → publish → archive),
 * the data-table adminList, and the staff `applicable` evaluation used at
 * checkout (eligibility + computed discount + upsell hints).
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

  // ── Admin wizard (managers + owners) ───────────────────────────────────────
  templates: managerProcedure.query(async ({ ctx }) => {
    const id = await requireOrg();
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    const en = lc.locale === "en";
    return PROMO_TEMPLATES.map((t) => ({
      key: t.key,
      type: t.type,
      name: en ? t.name.en : t.name.es,
      badgeLabel: t.badgeLabel,
      backgroundCss: t.backgroundCss,
      shortDescription: en ? t.shortDescription.en : t.shortDescription.es,
    }));
  }),
  create: managerProcedure
    .input(z.object({ templateKey: z.string().optional() }).optional())
    .mutation(async ({ ctx, input }) => {
      const id = await requireOrg();
      const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
      return makeService(ctx.db).create(id, ctx.session.user.id, input?.templateKey, lc);
    }),
  getState: managerProcedure
    .input(idInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).getState(await requireOrg(), input.id)),
  advance: managerProcedure
    .input(z.object({ id: z.string().uuid(), step: z.string(), input: z.unknown() }))
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).advance(
        await requireOrg(),
        ctx.session.user.id,
        input.id,
        input.step,
        input.input,
      ),
    ),
  publish: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).publish(await requireOrg(), input.id)),
  archive: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).archive(await requireOrg(), input.id)),
  patchContent: managerProcedure
    .input(patchContentSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).patchContent(await requireOrg(), input)),
  get: managerProcedure
    .input(idInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).get(await requireOrg(), input.id)),
  refOptions: managerProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      await requireOrg();
      return new PromoRepository(ctx.db).productRefOptions(input.productId);
    }),
  refLabels: managerProcedure
    .input(z.object({ refs: z.array(itemRefSchema).max(100) }))
    .query(async ({ ctx, input }) => {
      await requireOrg();
      const map = await new PromoRepository(ctx.db).refNames(input.refs);
      return Object.fromEntries(map);
    }),
  adminList: managerProcedure
    .input(adminListInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).adminList(await requireOrg(), input)),
  analytics: managerProcedure
    .input(promoAnalyticsInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).analytics(await requireOrg(), input.from)),
  remove: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).remove(await requireOrg(), input.id)),

  // ── Checkout (cashier) ─────────────────────────────────────────────────────
  applicable: staffProcedure.input(applicableInputSchema).query(async ({ ctx, input }) => {
    const id = await requireOrg();
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return makeService(ctx.db).applicable(id, input.customerId, input.cart, lc);
  }),
});

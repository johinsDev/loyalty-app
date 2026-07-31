import { type db as Db } from "@loyalty/db";
import { z } from "zod";

import { loadLocaleContext } from "../_shared/localize";
import { cachedListRead } from "../_shared/list-cache";
import { managerProcedure, orgId, publicProcedure, requireOrg, router, staffProcedure } from "../../trpc";
import { PromoRepository } from "./repository";
import {
  adminListInputSchema,
  applicableInputSchema,
  homePromosInputSchema,
  idInputSchema,
  itemRefSchema,
  patchContentSchema,
  promoAnalyticsInputSchema,
  publicListInputSchema,
  slugInputSchema,
  variantAxesInputSchema,
} from "./schemas";
import { PromoService } from "./service";
import { PROMO_TEMPLATES } from "./templates";

function makeService(db: typeof Db): PromoService {
  return new PromoService(db, new PromoRepository(db));
}
/**
 * Promotions. Public localized reads (home rail + /promos hub + detail), the
 * manager server-driven wizard (create → getState/advance → publish → archive),
 * the data-table adminList, and the staff `applicable` evaluation used at
 * checkout (eligibility + computed discount + upsell hints).
 */
export const promocionesRouter = router({
  // ── Public (cacheable, localized) ──────────────────────────────────────────
  homePromos: publicProcedure.input(homePromosInputSchema).query(async ({ ctx, input }) => {
    const id = orgId(ctx);
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return makeService(ctx.db).homePromos(id, lc, input.storeId);
  }),
  listPublic: publicProcedure.input(publicListInputSchema).query(async ({ ctx, input }) => {
    const id = orgId(ctx);
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return makeService(ctx.db).listPromos(id, lc, input);
  }),
  bySlug: publicProcedure.input(slugInputSchema).query(async ({ ctx, input }) => {
    const id = orgId(ctx);
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return makeService(ctx.db).promoBySlug(id, input.slug, lc);
  }),

  // Cashier catalog — active promos with store scope + exclusivity (staff).
  staffCatalog: staffProcedure.query(async ({ ctx }) => {
    const id = orgId(ctx);
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return makeService(ctx.db).staffCatalog(id, lc);
  }),

  // ── Admin wizard (managers + owners) ───────────────────────────────────────
  templates: managerProcedure.query(async ({ ctx }) => {
    const id = requireOrg(ctx);
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
      const id = requireOrg(ctx);
      const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
      return makeService(ctx.db).create(id, ctx.session.user.id, input?.templateKey, lc);
    }),
  getState: managerProcedure
    .input(idInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).getState(requireOrg(ctx), input.id)),
  advance: managerProcedure
    .input(z.object({ id: z.string().uuid(), step: z.string(), input: z.unknown() }))
    .mutation(async ({ ctx, input }) =>
      makeService(ctx.db).advance(
        requireOrg(ctx),
        ctx.session.user.id,
        input.id,
        input.step,
        input.input,
      ),
    ),
  publish: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).publish(requireOrg(ctx), input.id)),
  archive: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).archive(requireOrg(ctx), input.id)),
  patchContent: managerProcedure
    .input(patchContentSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).patchContent(requireOrg(ctx), input)),
  get: managerProcedure
    .input(idInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).get(requireOrg(ctx), input.id)),
  refOptions: managerProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      requireOrg(ctx);
      return new PromoRepository(ctx.db).productRefOptions(input.productId);
    }),
  refLabels: managerProcedure
    .input(z.object({ refs: z.array(itemRefSchema).max(100) }))
    .query(async ({ ctx, input }) => {
      requireOrg(ctx);
      const map = await new PromoRepository(ctx.db).refNames(input.refs);
      return Object.fromEntries(map);
    }),
  /** Powers the variant-swap reward's axis picker: which option axes exist
   *  across the products in scope, how many carry each, and what a chosen
   *  from→to pair costs per product. Uncached — it reads a catalog the admin
   *  may be editing in another tab, and stale coverage would mislead. */
  variantAxes: managerProcedure
    .input(variantAxesInputSchema)
    .query(async ({ ctx, input }) => {
      const org = requireOrg(ctx);
      const pair =
        input.optionName && input.fromValueLabel && input.toValueLabel
          ? {
              optionName: input.optionName,
              fromValueLabel: input.fromValueLabel,
              toValueLabel: input.toValueLabel,
            }
          : undefined;
      return new PromoRepository(ctx.db).variantAxes(org, input.refs, pair);
    }),
  adminList: managerProcedure
    .input(adminListInputSchema)
    .query(async ({ ctx, input }) => {
      const org = requireOrg(ctx);
      return cachedListRead(ctx, "promotions", org, input, () =>
        makeService(ctx.db).adminList(org, input),
      );
    }),
  analytics: managerProcedure
    .input(promoAnalyticsInputSchema)
    .query(async ({ ctx, input }) => makeService(ctx.db).analytics(requireOrg(ctx), input.from)),
  promoStats: managerProcedure
    .input(promoAnalyticsInputSchema.extend({ id: idInputSchema.shape.id }))
    .query(async ({ ctx, input }) =>
      makeService(ctx.db).promoStats(requireOrg(ctx), input.id, input.from),
    ),
  remove: managerProcedure
    .input(idInputSchema)
    .mutation(async ({ ctx, input }) => makeService(ctx.db).remove(requireOrg(ctx), input.id)),

  // ── Checkout (cashier) ─────────────────────────────────────────────────────
  applicable: staffProcedure.input(applicableInputSchema).query(async ({ ctx, input }) => {
    const id = requireOrg(ctx);
    const lc = await loadLocaleContext(ctx.db, id, ctx.headers);
    return makeService(ctx.db).applicable(id, input.customerId, input.cart, lc);
  }),
});

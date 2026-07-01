import { type db as Db, getPrimaryOrganizationId } from "@loyalty/db";
import { z } from "zod";

import {
  type CacheBinding,
  managerProcedure,
  protectedProcedure,
  type RealtimeBinding,
  rateLimit,
  router,
  staffProcedure,
} from "../../trpc";
import { resolveActiveStoreId } from "../_shared/store-context";
import { RewardsRepository } from "./repository";
import { RewardsService } from "./service";
import {
  cancelClaimInputSchema,
  claimInputSchema,
  confirmClaimWithCodeInputSchema,
  customerIdInputSchema,
  historyInputSchema,
  issueClaimTokenInputSchema,
  listInputSchema,
  requestClaimInputSchema,
  rewardIdInputSchema,
  setClaimCurrencyInputSchema,
} from "./schemas";

/** The single principal org (single-tenant pilot). */
const orgId = async (): Promise<string> =>
  (await getPrimaryOrganizationId()) ?? "";

/** Shared builder — the purchase orchestration reuses the repo + newlyReady. */
export function buildRewardsService(ctx: {
  db: typeof Db;
  realtime?: RealtimeBinding;
  cache?: CacheBinding;
}): RewardsService {
  return new RewardsService(new RewardsRepository(ctx.db), {
    realtime: ctx.realtime,
    cache: ctx.cache,
    signSecret: process.env.REALTIME_AUTH_SECRET ?? "",
  });
}

export const rewardsRouter = router({
  // ---- Admin ----------------------------------------------------------
  /** Lightweight active-reward catalog for admin pickers (campaign offer link). */
  catalog: managerProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { rows } = await new RewardsRepository(ctx.db).listCatalog(
        await orgId(),
        { search: input?.search, limit: 20 },
      );
      return rows.map((r) => ({ id: r.id, name: r.name }));
    }),

  // ---- Customer (self) ------------------------------------------------
  list: protectedProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) =>
      buildRewardsService(ctx).list(await orgId(), ctx.session.user.id, input),
    ),

  detail: protectedProcedure
    .input(rewardIdInputSchema)
    .query(async ({ ctx, input }) =>
      buildRewardsService(ctx).detail(
        await orgId(),
        ctx.session.user.id,
        input.rewardId,
      ),
    ),

  levels: protectedProcedure.query(async ({ ctx }) =>
    buildRewardsService(ctx).levels(await orgId(), ctx.session.user.id),
  ),

  recentRedemptions: protectedProcedure.query(async ({ ctx }) =>
    buildRewardsService(ctx).recentRedemptions(
      await orgId(),
      ctx.session.user.id,
    ),
  ),

  history: protectedProcedure
    .input(historyInputSchema)
    .query(async ({ ctx, input }) =>
      buildRewardsService(ctx).history(await orgId(), ctx.session.user.id, input),
    ),

  issueClaimToken: protectedProcedure
    .input(issueClaimTokenInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildRewardsService(ctx).issueClaimToken(
        await orgId(),
        ctx.session.user.id,
        input.rewardId,
        input.currency,
      ),
    ),

  // Customer rehydration of the active code after a reload — the realtime
  // `reward.claim-code` event won't re-fire, so the server is the source of
  // truth. Covers reward + streak claims (shared cache index).
  myActiveClaim: protectedProcedure.query(async ({ ctx }) =>
    buildRewardsService(ctx).myActiveClaim(ctx.session.user.id),
  ),

  // Customer revoke of a pending code-based claim (e.g. closed the modal by
  // accident, or changed their mind) — bound to the authenticated customer.
  cancelClaim: protectedProcedure
    .input(cancelClaimInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildRewardsService(ctx).cancelClaim(ctx.session.user.id, input.pendingId),
    ),

  // Customer picks the spend currency for an OR reward affordable with both
  // sellos + puntos (the chooser lives on their phone, not the cashier). Bound
  // to the authenticated customer + validated against the pending's options.
  setClaimCurrency: protectedProcedure
    .input(setClaimCurrencyInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildRewardsService(ctx).setClaimCurrency(
        ctx.session.user.id,
        input.pendingId,
        input.currency,
      ),
    ),

  // ---- Cashier (staff) ------------------------------------------------
  claim: staffProcedure
    .use(
      rateLimit({ name: "rewards.claim", limit: 30, window: "1m", by: "user" }),
    )
    .input(claimInputSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await orgId();
      const storeId = await resolveActiveStoreId(
        ctx.db,
        org,
        ctx.session.user.id,
        input.storeId,
      );
      return buildRewardsService(ctx).claim(
        org,
        ctx.session.user.id,
        input.token,
        storeId,
      );
    }),

  // Code-based claim (the "no scanner" path): request a 6-digit code bound to
  // this staff member + customer, then confirm it. Keyed per (staff, customer)
  // so one cashier can't spam codes at one customer; mirrors `claim`'s ceiling.
  requestClaim: staffProcedure
    .use(
      rateLimit({
        name: "rewards.requestClaim",
        limit: 30,
        window: "1m",
        by: (ctx, input) => {
          const userId = ctx.session?.user?.id;
          const customerId = (input as { customerId?: string }).customerId;
          return userId ? `${userId}:${customerId ?? ""}` : null;
        },
      }),
    )
    .input(requestClaimInputSchema)
    .mutation(async ({ ctx, input }) =>
      buildRewardsService(ctx).requestClaim(
        await orgId(),
        ctx.session.user.id,
        input.customerId,
        input.rewardId,
        // The customer chooses the currency on their phone; the cashier no
        // longer sends one. `input.currency` is optional for back-compat.
        input.currency,
      ),
    ),

  confirmClaimWithCode: staffProcedure
    .use(
      rateLimit({
        name: "rewards.confirmClaimWithCode",
        limit: 30,
        window: "1m",
        by: "user",
      }),
    )
    .input(confirmClaimWithCodeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const org = await orgId();
      const storeId = await resolveActiveStoreId(
        ctx.db,
        org,
        ctx.session.user.id,
        input.storeId,
      );
      return buildRewardsService(ctx).confirmClaimWithCode(
        org,
        ctx.session.user.id,
        input.pendingId,
        input.code,
        storeId,
      );
    }),

  availableForCustomer: staffProcedure
    .input(customerIdInputSchema)
    .query(async ({ ctx, input }) =>
      buildRewardsService(ctx).availableForCustomer(await orgId(), input.customerId),
    ),
});

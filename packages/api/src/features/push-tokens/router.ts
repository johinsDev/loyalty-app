import { getPrimaryOrganizationId } from "@loyalty/db";
import { TRPCError } from "@trpc/server";
import { tasks } from "@trigger.dev/sdk/v3";
import { z } from "zod";

import {
  ownerProcedure,
  protectedProcedure,
  rateLimit,
  router,
} from "../../trpc";
import { PushTokenRepository } from "./repository";
import {
  listForCustomerInputSchema,
  registerInputSchema,
  revokeInputSchema,
} from "./schemas";
import { PushTokenService } from "./service";

// Untyped trigger by ID — typing the payload would require depending
// on @loyalty/jobs from @loyalty/api, but jobs already depends on api
// (cycle). The payload shape stays in sync via the task definition in
// packages/jobs/trigger/send-test-push.ts.
type SendTestPushPayload = {
  userId: string;
  title?: string;
  body?: string;
};

const sendTestInputSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    body: z.string().min(1).max(280).optional(),
  })
  .default({});

/**
 * Resolve the token's owner server-side: `customerId` from the
 * authenticated session, `organizationId` from the primary org. The
 * client never supplies either (it can't be trusted to), so a token
 * is always scoped to the caller. Throws until an org is provisioned.
 */
async function resolvePushIdentity(customerId: string) {
  const organizationId = await getPrimaryOrganizationId();
  if (!organizationId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No organization provisioned yet.",
    });
  }
  return { customerId, organizationId };
}

/**
 * `protectedProcedure` — registering / revoking a push token is a
 * per-user action; `customerId` + `organizationId` are resolved from
 * the session via `resolvePushIdentity`, never trusted from input.
 */
export const pushTokensRouter = router({
  register: protectedProcedure
    .use(
      rateLimit({
        name: "pushTokens.register",
        limit: 10,
        window: "1m",
        by: "user",
      }),
    )
    .input(registerInputSchema)
    .mutation(async ({ ctx, input }) => {
      const identity = await resolvePushIdentity(ctx.session.user.id);
      const service = new PushTokenService(new PushTokenRepository(ctx.db));
      return service.register(input, identity);
    }),

  list: protectedProcedure
    .input(listForCustomerInputSchema)
    .query(({ ctx, input }) => {
      const service = new PushTokenService(new PushTokenRepository(ctx.db));
      return service.list(input);
    }),

  revoke: protectedProcedure
    .input(revokeInputSchema)
    .mutation(async ({ ctx, input }) => {
      const identity = await resolvePushIdentity(ctx.session.user.id);
      const service = new PushTokenService(new PushTokenRepository(ctx.db));
      return service.revoke(input.token, identity);
    }),

  /**
   * Server-side helper used by the bootstraps' `tokenLookup` to feed
   * the auto sender. Returns active tokens for a customer formatted
   * as `{ token, platform }` for `PushTokenLookup`.
   */
  listForLookup: protectedProcedure
    .input(listForCustomerInputSchema)
    .query(async ({ ctx, input }) => {
      const service = new PushTokenService(new PushTokenRepository(ctx.db));
      const rows = await service.list(input);
      return rows.map((r) => ({
        token: r.token,
        platform: r.platform as "webpush" | "expo",
      }));
    }),

  /**
   * Owner-only smoke helper. Fires the `send-test-push` Trigger.dev
   * task against the caller's own active tokens. Same delivery
   * pipeline real flows will use (stamp earned → trigger task →
   * push.send) so the smoke verifies VAPID + SW + DB end to end.
   *
   * The task does the actual send; this procedure just queues it
   * and returns 200 immediately so the UI feels snappy.
   */
  sendTest: ownerProcedure
    .input(sendTestInputSchema)
    .mutation(async ({ ctx, input }) => {
      const service = new PushTokenService(new PushTokenRepository(ctx.db));
      const tokens = await service.list({
        customerId: ctx.session.user.id,
        organizationId: (await getPrimaryOrganizationId()) ?? "",
      });
      if (tokens.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "No active push tokens for your user. Sign in on apps/web and click 'Enable notifications' first.",
        });
      }
      const payload: SendTestPushPayload = {
        userId: ctx.session.user.id,
        title: input.title,
        body: input.body,
      };
      await tasks.trigger("send-test-push", payload);
      return { ok: true as const, tokens: tokens.length };
    }),
});

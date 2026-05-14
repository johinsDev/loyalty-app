import { protectedProcedure, router } from "../../trpc";
import { PushTokenRepository } from "./repository";
import {
  listForCustomerInputSchema,
  registerInputSchema,
  revokeInputSchema,
} from "./schemas";
import { PushTokenService } from "./service";

/**
 * `protectedProcedure` — registering / revoking a push token is a
 * per-user action. Future hardening: scope `customerId` to the
 * caller's active organization instead of trusting the input
 * (matches the stub `clientes` router which has the same TODO).
 */
export const pushTokensRouter = router({
  register: protectedProcedure
    .input(registerInputSchema)
    .mutation(({ ctx, input }) => {
      const service = new PushTokenService(new PushTokenRepository(ctx.db));
      return service.register(input);
    }),

  list: protectedProcedure
    .input(listForCustomerInputSchema)
    .query(({ ctx, input }) => {
      const service = new PushTokenService(new PushTokenRepository(ctx.db));
      return service.list(input);
    }),

  revoke: protectedProcedure
    .input(revokeInputSchema)
    .mutation(({ ctx, input }) => {
      const service = new PushTokenService(new PushTokenRepository(ctx.db));
      return service.revoke(input);
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
});

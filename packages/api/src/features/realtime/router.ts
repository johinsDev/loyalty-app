import { parseRoom, type RoomName } from "@loyalty/realtime";
import { TRPCError } from "@trpc/server";

import { protectedProcedure, router } from "../../trpc";
import {
  issueTicketInputSchema,
  publishHelloInputSchema,
} from "./schemas";
import { RealtimeService } from "./service";

/** `outbox`-style: log/fake providers stay safe in prod; we still gate. */
function isDevOrPreview(): boolean {
  const env = process.env.VERCEL_ENV;
  return env === "preview" || env === "development" || !env;
}

export const realtimeRouter = router({
  /**
   * Mints a short-lived JWT the client uses to authenticate its
   * WebSocket connection to PartyKit. See
   * `.claude/skills/realtime/SKILL.md#auth-flow`.
   */
  issueTicket: protectedProcedure
    .input(issueTicketInputSchema)
    .mutation(async ({ ctx, input }) => {
      const secret = process.env.REALTIME_AUTH_SECRET;
      if (!secret) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "REALTIME_AUTH_SECRET is not configured",
        });
      }
      const service = new RealtimeService({
        secret,
        roomPrefix: process.env.REALTIME_ROOM_PREFIX,
      });
      // v1: assume userId == customerId until the user↔customer table
      // mapping lands. Same TODO as pushTokens.register.
      return service.issueTicket(input, {
        userId: ctx.session.user.id,
        customerId: ctx.session.user.id,
      });
    }),

  /**
   * Dev-only smoke helper: publish a synthetic `dev.hello` event into
   * a room. The `(dev)/realtime` page calls this so you can watch the
   * round-trip. Returns 404 in production (the `realtime` instance
   * isn't bound to `ctx` there because the env vars aren't set).
   */
  publishHello: protectedProcedure
    .input(publishHelloInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!isDevOrPreview()) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      if (!ctx.realtime) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "realtime client not bound to ctx. Wire `apps/<app>/src/lib/realtime.ts` and ensure PARTYKIT_HOST + REALTIME_AUTH_SECRET are set.",
        });
      }
      try {
        parseRoom(input.roomId as RoomName);
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "invalid roomId" });
      }
      await ctx.realtime.publish(input.roomId as RoomName, {
        event: "dev.hello",
        data: {
          message: input.message,
          from: ctx.session.user.id,
        },
      });
      return { ok: true as const };
    }),
});

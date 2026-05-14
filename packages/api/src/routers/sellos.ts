import { loyaltyCard } from "@loyalty/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

export const sellosRouter = router({
  /**
   * Add stamp(s) to a loyalty card. Stub implementation today — the
   * actual insert + bump live in a follow-up.
   *
   * What's wired NOW: every successful call publishes a `stamp.earned`
   * realtime event to the card's customer room so any open device
   * (the customer's PWA, future Expo app) lights up immediately.
   *
   * The publish is best-effort: a realtime failure won't roll back
   * the stamp insert (when it exists). For history, lean on the
   * future database notifications channel — realtime is ephemeral.
   */
  add: protectedProcedure
    .input(
      z.object({
        cardId: z.string().uuid(),
        amount: z.number().int().positive().default(1),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const card = (
        await ctx.db
          .select({
            id: loyaltyCard.id,
            customerId: loyaltyCard.customerId,
            currentStamps: loyaltyCard.currentStamps,
          })
          .from(loyaltyCard)
          .where(eq(loyaltyCard.id, input.cardId))
          .limit(1)
      )[0];

      // TODO: insert stamp + bump card.currentStamps in a tx
      const newTotal = (card?.currentStamps ?? 0) + input.amount;

      if (card && ctx.realtime) {
        await ctx.realtime
          .publish(`customer:${card.customerId}`, {
            event: "stamp.earned",
            data: {
              cardId: card.id,
              amount: input.amount,
              totalStamps: newTotal,
              ...(input.note && { note: input.note }),
            },
          })
          .catch(() => {
            // best-effort: never fail the mutation because realtime
            // was unreachable. The push channel + database channel
            // (when wired) will catch the user up.
          });
      }

      return { ok: true, totalStamps: newTotal };
    }),
});

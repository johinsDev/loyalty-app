import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

export const sellosRouter = router({
  add: protectedProcedure
    .input(
      z.object({
        cardId: z.string().uuid(),
        amount: z.number().int().positive().default(1),
        note: z.string().optional(),
      }),
    )
    .mutation(async () => {
      // TODO: insert stamp + bump card.currentStamps in a tx
      return { ok: true };
    }),
});

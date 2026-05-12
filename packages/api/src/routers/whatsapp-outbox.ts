import { whatsappOutbox } from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { protectedProcedure, router } from "../trpc";

/**
 * Read-only view of the `whatsapp_outbox` table. Only relevant when
 * `WHATSAPP_PROVIDER=outbox` (preview deploys, sometimes dev). Returns
 * empty results in production where Twilio is the provider.
 *
 * Powers the admin panel at `/[locale]/(dashboard)/whatsapp-outbox`.
 */
export const whatsappOutboxRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        to: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      }),
    )
    .query(async ({ ctx, input }) => {
      const conditions = input.to ? [eq(whatsappOutbox.to, input.to)] : [];
      return ctx.db
        .select()
        .from(whatsappOutbox)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(whatsappOutbox.sentAt))
        .limit(input.limit);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(whatsappOutbox)
        .where(eq(whatsappOutbox.id, input.id))
        .limit(1);
      const row = rows[0];
      if (!row) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `whatsapp_outbox row "${input.id}" not found`,
        });
      }
      return row;
    }),

  latestForRecipient: protectedProcedure
    .input(z.object({ to: z.string(), limit: z.number().int().min(1).max(20).default(5) }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(whatsappOutbox)
        .where(eq(whatsappOutbox.to, input.to))
        .orderBy(desc(whatsappOutbox.sentAt))
        .limit(input.limit);
    }),
});

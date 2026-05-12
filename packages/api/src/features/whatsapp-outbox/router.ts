import { publicProcedure, router } from "../../trpc";
import { WhatsAppOutboxRepository } from "./repository";
import {
  getInputSchema,
  latestForRecipientInputSchema,
  listInputSchema,
} from "./schemas";
import { WhatsAppOutboxService } from "./service";

/**
 * `publicProcedure` on purpose: the dev view on apps/web is gated by
 * env (`apps/web/lib/dev-only.ts`), not by auth — devs hunting for an
 * OTP aren't logged in yet. Production deploys serve 404 at the
 * page + endpoint layer, so this router stays safely empty in prod.
 */
export const whatsappOutboxRouter = router({
  list: publicProcedure
    .input(listInputSchema)
    .query(({ ctx, input }) => {
      const service = new WhatsAppOutboxService(
        new WhatsAppOutboxRepository(ctx.db),
      );
      return service.list(input);
    }),

  get: publicProcedure
    .input(getInputSchema)
    .query(({ ctx, input }) => {
      const service = new WhatsAppOutboxService(
        new WhatsAppOutboxRepository(ctx.db),
      );
      return service.get(input.id);
    }),

  latestForRecipient: publicProcedure
    .input(latestForRecipientInputSchema)
    .query(({ ctx, input }) => {
      const service = new WhatsAppOutboxService(
        new WhatsAppOutboxRepository(ctx.db),
      );
      return service.latestForRecipient(input);
    }),
});

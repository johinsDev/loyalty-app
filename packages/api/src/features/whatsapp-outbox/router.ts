import { ownerProcedure, router } from "../../trpc";
import { WhatsAppOutboxRepository } from "./repository";
import {
  getInputSchema,
  latestForRecipientInputSchema,
  listInputSchema,
} from "./schemas";
import { WhatsAppOutboxService } from "./service";

/**
 * `ownerProcedure` on purpose: only the operator's owner role can
 * inspect outbox traffic. The matching admin pages (apps/admin under
 * `(dev)/`) also gate at the layout level via `requireRole(OWNER_ONLY)`
 * + `isDevOnlyEnabled()`, so this router stays unreachable in prod.
 */
export const whatsappOutboxRouter = router({
  list: ownerProcedure
    .input(listInputSchema)
    .query(({ ctx, input }) => {
      const service = new WhatsAppOutboxService(
        new WhatsAppOutboxRepository(ctx.db),
      );
      return service.list(input);
    }),

  get: ownerProcedure
    .input(getInputSchema)
    .query(({ ctx, input }) => {
      const service = new WhatsAppOutboxService(
        new WhatsAppOutboxRepository(ctx.db),
      );
      return service.get(input.id);
    }),

  latestForRecipient: ownerProcedure
    .input(latestForRecipientInputSchema)
    .query(({ ctx, input }) => {
      const service = new WhatsAppOutboxService(
        new WhatsAppOutboxRepository(ctx.db),
      );
      return service.latestForRecipient(input);
    }),
});

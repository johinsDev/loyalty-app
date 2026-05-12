import type { SmsOutboxRow } from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";

import type {
  ListResult,
  SmsOutboxRepository,
} from "./repository";
import type { LatestForRecipientInput, ListInput } from "./schemas";

/**
 * Thin pass-through today. Lives here so future business rules
 * (mask content for non-admins, enforce opt-out, hide failed sends
 * from non-staff) have a single home above the repository.
 */
export class SmsOutboxService {
  constructor(private readonly repo: SmsOutboxRepository) {}

  list(input: ListInput): Promise<ListResult> {
    return this.repo.list(input);
  }

  async get(id: string): Promise<SmsOutboxRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `sms_outbox row "${id}" not found`,
      });
    }
    return row;
  }

  latestForRecipient(
    input: LatestForRecipientInput,
  ): Promise<SmsOutboxRow[]> {
    return this.repo.latestForRecipient(input);
  }
}

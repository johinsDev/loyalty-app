import type { PushTokenRow } from "@loyalty/db/schema";
import { TRPCError } from "@trpc/server";

import {
  expoTokenSchema,
  webPushSubscriptionSchema,
} from "@loyalty/push";

import type { PushTokenRepository } from "./repository";
import type {
  ListForCustomerInput,
  PushTokenIdentity,
  RegisterInput,
} from "./schemas";

/**
 * Wraps the repository with shape validation so the token column
 * holds either a valid `ExponentPushToken[…]` or a JSON-stringified
 * `PushSubscription` — never garbage.
 */
export class PushTokenService {
  constructor(private readonly repo: PushTokenRepository) {}

  register(
    input: RegisterInput,
    identity: PushTokenIdentity,
  ): Promise<PushTokenRow> {
    if (input.platform === "expo") {
      const parsed = expoTokenSchema.safeParse(input.token);
      if (!parsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid Expo push token (expected ExponentPushToken[...])",
        });
      }
    } else {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(input.token);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Web push token must be a JSON-stringified PushSubscription",
        });
      }
      const parsed = webPushSubscriptionSchema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid web push subscription shape",
        });
      }
    }
    return this.repo.upsert({ ...input, ...identity });
  }

  list(input: ListForCustomerInput): Promise<PushTokenRow[]> {
    return this.repo.listActiveForCustomer(
      input.customerId,
      input.organizationId,
    );
  }

  revoke(token: string, identity: PushTokenIdentity): Promise<number> {
    return this.repo.revoke(identity.customerId, identity.organizationId, token);
  }
}

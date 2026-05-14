import {
  parseRoom,
  signTicket,
  type RealtimeTicket,
  type RoomName,
} from "@loyalty/realtime";
import { TRPCError } from "@trpc/server";

import type { IssueTicketInput } from "./schemas";

interface AuthorizedCaller {
  /** Better Auth user id (from `session.user.id`). */
  userId: string;
  /**
   * The customer id for the caller. For v1 the input itself carries
   * the customer id (matches the stub `pushTokens.register` pattern);
   * future hardening: derive this from session metadata.
   */
  customerId: string;
}

export class RealtimeService {
  constructor(
    private readonly cfg: { secret: string; ttlSeconds?: number },
  ) {}

  /**
   * Issue a short-lived HS256 ticket for a single room. Authorization
   * rules (who can join which room) live here so adding a new party
   * = adding one new branch:
   *
   *   - `customer:<id>` — only the customer themselves (TODO: enforce
   *     once the user↔customer mapping is in place). For now we trust
   *     the caller, same as `pushTokens.register`.
   *   - `org:<id>` — NOT ALLOWED in v1. The party class doesn't exist
   *     yet; reject so a typo doesn't accidentally grant access.
   *   - `chat:<id>` — NOT ALLOWED in v1. Same reason.
   */
  async issueTicket(
    input: IssueTicketInput,
    caller: AuthorizedCaller,
  ): Promise<RealtimeTicket> {
    const { kind, body } = parseRoomSafe(input.roomId);

    if (kind === "customer") {
      // v1: trust the input. Future: ensure body === caller.customerId.
      // Logged here so we don't forget.
      void caller; // silence unused (will be used once linkage exists)
      return signTicket({
        customerId: body,
        roomId: input.roomId as RoomName,
        secret: this.cfg.secret,
        ttlSeconds: this.cfg.ttlSeconds,
      });
    }

    if (kind === "org" || kind === "chat") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Room kind "${kind}" is not enabled yet. See .claude/skills/realtime/SKILL.md for the rollout plan.`,
      });
    }

    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Unknown room kind "${kind}"`,
    });
  }
}

function parseRoomSafe(roomId: string): { kind: string; body: string } {
  try {
    return parseRoom(roomId as RoomName);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "invalid roomId" });
  }
}

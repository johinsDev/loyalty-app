import { isStaffRole, type Role } from "@loyalty/auth/server";
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
  /** App role (`member.role`). Only resolved for org rooms. */
  role?: Role;
  /** The org the caller belongs to, for org-room authorization. */
  organizationId?: string | null;
}

export class RealtimeService {
  constructor(
    private readonly cfg: {
      secret: string;
      ttlSeconds?: number;
      /**
       * Prepended to the room body so a shared party isolates rooms
       * per environment (previews set `pr-<n>-`; prod/local empty).
       * Must match `RealtimeClient`'s `roomPrefix` so the JWT room
       * claim equals the room the publisher targets.
       */
      roomPrefix?: string;
    },
  ) {}

  /**
   * Issue a short-lived HS256 ticket for a single room. Authorization
   * rules (who can join which room) live here so adding a new party
   * = adding one new branch:
   *
   *   - `customer:<id>` — only the customer themselves (TODO: enforce
   *     once the user↔customer mapping is in place). For now we trust
   *     the caller, same as `pushTokens.register`.
   *   - `org:<id>` — staff of that org only, enforced (the room is
   *     shared by every operator, so this one can't be trusted input).
   *   - `chat:<id>` — NOT ALLOWED in v1. The party class doesn't exist
   *     yet; reject so a typo doesn't accidentally grant access.
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
      // Prefix the body (not the identity): the JWT `room` claim +
      // `ticket.roomId` carry the prefix so the client connects to —
      // and the publisher targets — the same isolated room. `sub`
      // stays the real customer id.
      const actualRoom = `${kind}:${this.cfg.roomPrefix ?? ""}${body}` as RoomName;
      return signTicket({
        subject: body,
        roomId: actualRoom,
        secret: this.cfg.secret,
        ttlSeconds: this.cfg.ttlSeconds,
      });
    }

    if (kind === "org") {
      // Unlike the customer branch this is enforced, not trusted: the room is
      // shared by every operator, so the ticket must prove both that the
      // caller is staff and that it's THEIR org. `sub` is the user id, which
      // is what the party sees on the connection.
      if (!caller.role || !isStaffRole(caller.role)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "org rooms are for staff",
        });
      }
      if (!caller.organizationId || caller.organizationId !== body) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "not your organization",
        });
      }
      const actualRoom = `${kind}:${this.cfg.roomPrefix ?? ""}${body}` as RoomName;
      return signTicket({
        subject: caller.userId,
        roomId: actualRoom,
        secret: this.cfg.secret,
        ttlSeconds: this.cfg.ttlSeconds,
      });
    }

    if (kind === "chat") {
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

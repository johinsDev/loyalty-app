import { decodeJwt } from "jose";
import { describe, expect, it } from "vitest";

import { RealtimeService } from "../service";

const SECRET = "test-secret";
const ORG = "org_1";
const USER = "user_1";

function service(roomPrefix?: string) {
  return new RealtimeService({ secret: SECRET, roomPrefix });
}

const staff = {
  userId: USER,
  customerId: USER,
  role: "staff" as const,
  organizationId: ORG,
};

describe("issueTicket — org rooms", () => {
  it("mints a ticket for staff of that org", async () => {
    const ticket = await service().issueTicket({ roomId: `org:${ORG}` }, staff);
    expect(ticket.roomId).toBe(`org:${ORG}`);
    const claims = decodeJwt(ticket.token);
    // `sub` must be the operator's user id — the party sees this on the
    // connection, and the inbox is keyed by user.
    expect(claims.sub).toBe(USER);
    expect(claims.room).toBe(`org:${ORG}`);
  });

  it("lets managers and owners in too", async () => {
    for (const role of ["manager", "owner"] as const) {
      await expect(
        service().issueTicket({ roomId: `org:${ORG}` }, { ...staff, role }),
      ).resolves.toBeDefined();
    }
  });

  it("refuses a customer", async () => {
    // The whole point of the enforcement: this room carries shop signals.
    await expect(
      service().issueTicket(
        { roomId: `org:${ORG}` },
        { ...staff, role: "customer" },
      ),
    ).rejects.toThrow(/staff/);
  });

  it("refuses a caller with no resolved role", async () => {
    await expect(
      service().issueTicket(
        { roomId: `org:${ORG}` },
        { userId: USER, customerId: USER, organizationId: ORG },
      ),
    ).rejects.toThrow(/staff/);
  });

  it("refuses another org's room, even for an owner", async () => {
    await expect(
      service().issueTicket(
        { roomId: "org:someone_elses_shop" },
        { ...staff, role: "owner" },
      ),
    ).rejects.toThrow(/organization/);
  });

  it("refuses when the caller has no org", async () => {
    await expect(
      service().issueTicket(
        { roomId: `org:${ORG}` },
        { ...staff, organizationId: null },
      ),
    ).rejects.toThrow(/organization/);
  });

  it("prefixes the room per environment so previews stay isolated", async () => {
    // The publisher applies the same prefix; if these drift the admin joins a
    // room nobody publishes to and the badge silently never updates.
    const ticket = await service("pr-42-").issueTicket(
      { roomId: `org:${ORG}` },
      staff,
    );
    expect(ticket.roomId).toBe(`org:pr-42-${ORG}`);
    expect(decodeJwt(ticket.token).room).toBe(`org:pr-42-${ORG}`);
  });

  it("still rejects chat rooms", async () => {
    await expect(
      service().issueTicket({ roomId: "chat:x" }, { ...staff, role: "owner" }),
    ).rejects.toThrow(/not enabled/);
  });
});

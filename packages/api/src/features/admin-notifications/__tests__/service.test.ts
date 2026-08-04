import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import type { AdminNotificationRepository } from "../repository";
import { AdminNotificationService } from "../service";

const USER = "user_1";
const ORG = "org_1";

function serviceWith(affected: number) {
  const calls: Array<[string, ...unknown[]]> = [];
  const repo = {
    markRead: async (...args: unknown[]) => {
      calls.push(["markRead", ...args]);
      return affected;
    },
    markAllRead: async () => affected,
    archive: async (...args: unknown[]) => {
      calls.push(["archive", ...args]);
      return affected;
    },
    archiveAll: async () => affected,
    unarchive: async () => affected,
  } as unknown as AdminNotificationRepository;
  return { service: new AdminNotificationService(repo), calls };
}

describe("AdminNotificationService", () => {
  it("scopes every mutation to the caller", async () => {
    const { service, calls } = serviceWith(1);
    await service.markRead("alert_1", USER, ORG);
    // The (id, userId, orgId) triple is the whole security boundary — an alert
    // belongs to one recipient, so nobody can mark someone else's as read.
    expect(calls[0]).toEqual(["markRead", "alert_1", USER, ORG]);
  });

  it("raises NOT_FOUND when a mutation touches nothing", async () => {
    const { service } = serviceWith(0);
    await expect(service.markRead("ghost", USER, ORG)).rejects.toBeInstanceOf(
      TRPCError,
    );
    await expect(service.archive(["ghost"], USER, ORG)).rejects.toThrow(
      /not found/,
    );
    await expect(service.unarchive(["ghost"], USER, ORG)).rejects.toThrow(
      /not found/,
    );
  });

  it("reports zero for bulk actions instead of failing", async () => {
    // "Mark all read" on an already-clean inbox is a no-op, not an error.
    const { service } = serviceWith(0);
    await expect(service.markAllRead(USER, ORG)).resolves.toEqual({
      updated: 0,
    });
    await expect(service.archiveAll(USER, ORG)).resolves.toEqual({
      updated: 0,
    });
  });

  it("passes through the number of rows a bulk action touched", async () => {
    const { service } = serviceWith(7);
    await expect(service.archiveAll(USER, ORG)).resolves.toEqual({
      updated: 7,
    });
  });
});

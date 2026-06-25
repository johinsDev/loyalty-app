import type { CustomerRow } from "@loyalty/db/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProfileRepository } from "../repository";
import { ProfileService } from "../service";

const ORG = "org_1";
const CUSTOMER = "cust_1";

function customer(over: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: CUSTOMER,
    organizationId: ORG,
    phone: "+573001112222",
    email: "+573001112222@phone.local",
    name: "Ana",
    nickname: null,
    avatarPreset: null,
    avatarUrl: null,
    avatarThumbhash: null,
    createdAt: new Date("2024-03-01T00:00:00Z"),
    updatedAt: new Date("2024-03-01T00:00:00Z"),
    ...over,
  } as CustomerRow;
}

class FakeRepo {
  row: CustomerRow = customer();
  taken = false;
  userPhone: string | null = "+573001112222";
  visits = 5;
  google = false;

  get = vi.fn(async () => this.row);
  nicknameTaken = vi.fn(async () => this.taken);
  updateName = vi.fn(async () => {});
  updateNickname = vi.fn(async () => {});
  updateAvatar = vi.fn(async () => {});
  updatePhone = vi.fn(async () => {});
  updateEmail = vi.fn(async () => {});
  visitCount = vi.fn(async () => this.visits);
  googleLinked = vi.fn(async () => this.google);
  userPhoneNumber = vi.fn(async () => this.userPhone);
}

interface EnqueueArg {
  customerIds: string[];
  organizationId: string;
  notificationKey: string;
  payload?: { newPhoneMasked?: string };
  recipient?: { phone: string; email: string | null; name: string | null };
}

function build(repo: FakeRepo) {
  const enqueue = vi.fn<(p: EnqueueArg) => Promise<void>>(async () => {});
  const pointsSummary = vi.fn(async () => ({ balance: 312, tierName: "Hoja" }));
  const service = new ProfileService(repo as unknown as ProfileRepository, {
    pointsSummary,
    enqueue,
  });
  return { service, enqueue, pointsSummary };
}

describe("ProfileService.checkNickname", () => {
  let repo: FakeRepo;
  beforeEach(() => {
    repo = new FakeRepo();
  });

  it("rejects invalid formats", async () => {
    const { service } = build(repo);
    for (const bad of ["ab", "WAY_TOO_LONG_NICKNAME_X", "has space", "dash-no"]) {
      const r = await service.checkNickname(ORG, CUSTOMER, bad);
      expect(r).toEqual({ available: false, reason: "invalid" });
    }
  });

  it("lowercases and treats the caller's own nickname as available (self)", async () => {
    repo.row = customer({ nickname: "ana" });
    const { service } = build(repo);
    const r = await service.checkNickname(ORG, CUSTOMER, "ANA");
    expect(r).toEqual({ available: true, reason: "self" });
  });

  it("reports taken", async () => {
    repo.taken = true;
    const { service } = build(repo);
    const r = await service.checkNickname(ORG, CUSTOMER, "bob");
    expect(r).toEqual({ available: false, reason: "taken" });
  });

  it("reports available", async () => {
    const { service } = build(repo);
    const r = await service.checkNickname(ORG, CUSTOMER, "bob");
    expect(r).toEqual({ available: true });
  });
});

describe("ProfileService.updateNickname", () => {
  it("throws CONFLICT when taken (TOCTOU re-check)", async () => {
    const repo = new FakeRepo();
    repo.taken = true;
    const { service } = build(repo);
    await expect(
      service.updateNickname(ORG, CUSTOMER, "bob"),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(repo.updateNickname).not.toHaveBeenCalled();
  });

  it("persists when available", async () => {
    const repo = new FakeRepo();
    const { service } = build(repo);
    await service.updateNickname(ORG, CUSTOMER, "bob");
    expect(repo.updateNickname).toHaveBeenCalledWith(ORG, CUSTOMER, "bob");
  });
});

describe("ProfileService.updateAvatar (mutually exclusive)", () => {
  it("preset clears the custom columns", async () => {
    const repo = new FakeRepo();
    const { service } = build(repo);
    await service.updateAvatar(ORG, CUSTOMER, { kind: "preset", preset: "matcha" });
    expect(repo.updateAvatar).toHaveBeenCalledWith(ORG, CUSTOMER, {
      avatarPreset: "matcha",
      avatarUrl: null,
      avatarThumbhash: null,
    });
  });

  it("custom clears the preset", async () => {
    const repo = new FakeRepo();
    const { service } = build(repo);
    await service.updateAvatar(ORG, CUSTOMER, {
      kind: "custom",
      avatarUrl: "https://cdn/x.webp",
      avatarThumbhash: "abc",
    });
    expect(repo.updateAvatar).toHaveBeenCalledWith(ORG, CUSTOMER, {
      avatarPreset: null,
      avatarUrl: "https://cdn/x.webp",
      avatarThumbhash: "abc",
    });
  });

  it("clear nulls everything", async () => {
    const repo = new FakeRepo();
    const { service } = build(repo);
    await service.updateAvatar(ORG, CUSTOMER, { kind: "clear" });
    expect(repo.updateAvatar).toHaveBeenCalledWith(ORG, CUSTOMER, {
      avatarPreset: null,
      avatarUrl: null,
      avatarThumbhash: null,
    });
  });
});

describe("ProfileService.confirmPhoneChange", () => {
  const NEW = "+573009998888";

  it("requires the login phone to already be swapped", async () => {
    const repo = new FakeRepo();
    repo.userPhone = "+573001112222"; // not yet swapped
    const { service, enqueue } = build(repo);
    await expect(
      service.confirmPhoneChange(ORG, CUSTOMER, NEW),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(enqueue).not.toHaveBeenCalled();
    expect(repo.updatePhone).not.toHaveBeenCalled();
  });

  it("alerts the OLD contact then mirrors the new phone", async () => {
    const repo = new FakeRepo();
    repo.userPhone = NEW; // client already swapped user.phoneNumber
    repo.row = customer({ phone: "+573001112222", email: "ana@gmail.com", name: "Ana" });
    const { service, enqueue } = build(repo);

    await service.confirmPhoneChange(ORG, CUSTOMER, NEW);

    expect(enqueue).toHaveBeenCalledTimes(1);
    const payload = enqueue.mock.calls[0]![0];
    expect(payload.notificationKey).toBe("phone-changed");
    // recipient = the OLD contact (so the alert reaches the previous number)
    expect(payload.recipient).toEqual({
      phone: "+573001112222",
      email: "ana@gmail.com",
      name: "Ana",
    });
    expect(payload.payload?.newPhoneMasked).toContain("8888");
    expect(repo.updatePhone).toHaveBeenCalledWith(ORG, CUSTOMER, NEW);

    // alert is enqueued BEFORE the row is updated
    const enqueueOrder = enqueue.mock.invocationCallOrder[0]!;
    const updateOrder = repo.updatePhone.mock.invocationCallOrder[0]!;
    expect(enqueueOrder).toBeLessThan(updateOrder);
  });

  it("drops a placeholder old email from the alert recipient", async () => {
    const repo = new FakeRepo();
    repo.userPhone = NEW;
    repo.row = customer({ phone: "+573001112222", email: "+573001112222@phone.local" });
    const { service, enqueue } = build(repo);
    await service.confirmPhoneChange(ORG, CUSTOMER, NEW);
    const payload = enqueue.mock.calls[0]![0];
    expect(payload.recipient?.email).toBeNull();
  });

  it("is idempotent once the row already holds the new phone", async () => {
    const repo = new FakeRepo();
    repo.userPhone = NEW;
    repo.row = customer({ phone: NEW });
    const { service, enqueue } = build(repo);
    await service.confirmPhoneChange(ORG, CUSTOMER, NEW);
    expect(enqueue).not.toHaveBeenCalled();
    expect(repo.updatePhone).not.toHaveBeenCalled();
  });
});

describe("ProfileService.me", () => {
  it("hides the placeholder email and composes stats", async () => {
    const repo = new FakeRepo();
    repo.row = customer({ email: "+573001112222@phone.local", nickname: "ana" });
    repo.visits = 47;
    repo.google = false;
    const { service } = build(repo);
    const me = await service.me(ORG, CUSTOMER);
    expect(me.email).toBeNull();
    expect(me.hasRealEmail).toBe(false);
    expect(me.nickname).toBe("ana");
    expect(me.stats).toEqual({ points: 312, tierName: "Hoja", visits: 47 });
    expect(me.googleLinked).toBe(false);
    expect(me.memberSince).toEqual(new Date("2024-03-01T00:00:00Z"));
  });

  it("exposes a real email", async () => {
    const repo = new FakeRepo();
    repo.row = customer({ email: "ana@gmail.com" });
    repo.google = true;
    const { service } = build(repo);
    const me = await service.me(ORG, CUSTOMER);
    expect(me.email).toBe("ana@gmail.com");
    expect(me.hasRealEmail).toBe(true);
    expect(me.googleLinked).toBe(true);
  });
});

describe("ProfileService.syncEmail", () => {
  it("mirrors a real email", async () => {
    const repo = new FakeRepo();
    const { service } = build(repo);
    const r = await service.syncEmail(ORG, CUSTOMER, "ana@gmail.com");
    expect(r).toEqual({ ok: true });
    expect(repo.updateEmail).toHaveBeenCalledWith(ORG, CUSTOMER, "ana@gmail.com");
  });

  it("ignores a placeholder email", async () => {
    const repo = new FakeRepo();
    const { service } = build(repo);
    const r = await service.syncEmail(ORG, CUSTOMER, "+573001112222@phone.local");
    expect(r).toEqual({ ok: false });
    expect(repo.updateEmail).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

import {
  type PendingRegister,
  REGISTER_PIN_TTL_SECONDS,
  registerPinKey,
  storePendingRegister,
  verifyRegisterPin,
} from "../register-pin";

class FakeCache {
  store = new Map<string, unknown>();
  get = vi.fn(async <T>(key: string): Promise<T | null> =>
    this.store.has(key) ? (this.store.get(key) as T) : null,
  );
  set = vi.fn(async (key: string, value: unknown, _ttl?: number) => {
    this.store.set(key, value);
  });
  delete = vi.fn(async (key: string) => {
    this.store.delete(key);
  });
  getOrSet = vi.fn(async <T>(key: string, factory: () => Promise<T>) => {
    if (this.store.has(key)) return this.store.get(key) as T;
    const v = await factory();
    this.store.set(key, v);
    return v;
  });
}

const base = {
  phone: "+573001234567",
  name: "Ana",
  organizationId: "org_1",
  staffId: "staff_1",
  acquisitionStoreId: "store_1",
};

describe("storePendingRegister", () => {
  it("stores a 6-digit code + zeroed attempts under the register key", async () => {
    const cache = new FakeCache();
    const { pendingId, code } = await storePendingRegister(cache as never, base);
    expect(code).toMatch(/^\d{6}$/);
    expect(cache.set).toHaveBeenCalledWith(
      registerPinKey(pendingId),
      expect.objectContaining({ ...base, code, attempts: 0 }),
      REGISTER_PIN_TTL_SECONDS,
    );
  });
});

describe("verifyRegisterPin", () => {
  async function seed(over: Partial<PendingRegister> = {}) {
    const cache = new FakeCache();
    const pendingId = "pend_1";
    cache.store.set(registerPinKey(pendingId), {
      ...base,
      code: "123456",
      attempts: 0,
      ...over,
    } satisfies PendingRegister);
    return { cache, pendingId };
  }

  it("returns the payload on the correct code", async () => {
    const { cache, pendingId } = await seed();
    const p = await verifyRegisterPin(cache as never, pendingId, "123456", "staff_1");
    expect(p).toMatchObject({ phone: base.phone, name: "Ana", acquisitionStoreId: "store_1" });
  });

  it("CODE_EXPIRED when the pending is gone", async () => {
    const cache = new FakeCache();
    await expect(verifyRegisterPin(cache as never, "missing", "123456", "staff_1")).rejects.toMatchObject(
      { code: "BAD_REQUEST", message: "CODE_EXPIRED" },
    );
  });

  it("NOT_YOUR_CLAIM when a different staff confirms", async () => {
    const { cache, pendingId } = await seed();
    await expect(verifyRegisterPin(cache as never, pendingId, "123456", "staff_2")).rejects.toMatchObject(
      { code: "FORBIDDEN", message: "NOT_YOUR_CLAIM" },
    );
  });

  it("CODE_INVALID increments attempts under the same TTL", async () => {
    const { cache, pendingId } = await seed();
    await expect(verifyRegisterPin(cache as never, pendingId, "000000", "staff_1")).rejects.toMatchObject(
      { message: "CODE_INVALID" },
    );
    expect(cache.set).toHaveBeenCalledWith(
      registerPinKey(pendingId),
      expect.objectContaining({ attempts: 1 }),
      REGISTER_PIN_TTL_SECONDS,
    );
  });

  it("TOO_MANY_ATTEMPTS burns the pending after 3 wrong tries", async () => {
    const { cache, pendingId } = await seed({ attempts: 3 });
    await expect(verifyRegisterPin(cache as never, pendingId, "000000", "staff_1")).rejects.toMatchObject(
      { message: "TOO_MANY_ATTEMPTS" },
    );
    expect(cache.delete).toHaveBeenCalledWith(registerPinKey(pendingId));
  });
});
